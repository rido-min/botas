# `onTurnError` Hook for Handler Error Visibility

## Problem Statement

When user-provided handlers or middleware throw exceptions in Node.js, the error is completely invisible to the developer by default:

1. Handler throws (e.g., missing Azure OpenAI credentials in `model.invoke()`)
2. Wrapped in `BotHandlerException` by `handleCoreActivityAsync`
3. Caught in `processAsync` → logged to `debug`-based logger (SILENT by default) → generic 500 returned
4. User sees nothing — no console output, no callback, no visibility

**Real-world impact:** Developers test samples (e.g., `04-ai-langchain-mcp`) without required environment variables and see silent failures with no actionable feedback.

**Root cause:** Node's `processAsync` HTTP helper swallows all errors and logs them at `debug` level, which is off by default. The logger abstraction prevents console output unless explicitly configured.

## Proposed Solution

Add an `onTurnError` callback hook to `BotApplication` that gives user code visibility into turn-level errors before they're collapsed into HTTP 500 responses.

```typescript
bot.onTurnError = async (error: unknown, activity?: CoreActivity) => {
  console.error('Turn error:', error);
  if (activity) {
    console.error('Activity type:', activity.type);
  }
};
```

## Rubber-Duck Critique Findings

### Blocking Issues

1. **Signature too narrow**
   - Proposed: `onTurnError(err: Error, activity: CoreActivity)`
   - Required: `onTurnError(error: unknown, activity?: CoreActivity)`
   - **Rationale:**
     - Middleware errors are also swallowed (not just handler errors)
     - JavaScript can throw non-Error values (`throw "string"`, `throw null`)
     - Some 500s happen before a valid CoreActivity exists (e.g., JSON parse errors after JWT validation)

2. **No defined behavior if `onTurnError` itself throws**
   - Must wrap in try/catch to prevent hook failures from masking the original error
   - The original error must still be logged and returned as 500 even if the hook fails
   - Hook exceptions should be logged separately but never break the error-handling flow

### Non-Blocking Recommendations

3. **Avoid always writing to `console.error`**
   - Cuts across the logger abstraction
   - Prefer the callback as primary visibility mechanism
   - Only `console.error` as fallback when using the default silent logger (no callback registered)

4. **Put `onTurnError` on `BotApplication` class, not `BotApplicationOptions`**
   - Matches existing pattern (`onActivity` is a class property, not a constructor option)
   - Allows setting the hook after instantiation (same as handler registration)

5. **Cross-language parity**
   - .NET and Python already propagate exceptions from their `processBody` equivalents
   - The hidden-error problem is mainly Node's `processAsync` HTTP helper
   - **Decision required:** Document as intentional Node-specific behavior OR add equivalent hooks to .NET/Python

6. **Don't special-case only `BotHandlerException`**
   - Log ALL errors being collapsed into 500, not just handler errors
   - Middleware exceptions, unknown errors, and non-Error throws all need visibility

## Design Decisions (Recommendations)

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Hook placement | `BotApplication` class property | Matches `onActivity` pattern |
| Hook signature | `(error: unknown, activity?: CoreActivity) => void \| Promise<void>` | Handles all error types and missing activity |
| Hook failure handling | Try/catch wrapper, log separately, never throw | Original error always takes precedence |
| Fallback console output | Only when no hook registered AND using default logger | Preserve logger abstraction while improving DX |
| Cross-language scope | Node.js only (initially) | .NET/Python already propagate exceptions; add later if needed |
| Error coverage | All 500 errors in `processAsync` | Middleware, handler, and pipeline errors all visible |

## API Surface

### Node.js

```typescript
export class BotApplication {
  /**
   * Optional error handler called before collapsing turn-level errors into HTTP 500.
   * 
   * Provides visibility into handler exceptions, middleware errors, and pipeline failures
   * that would otherwise be hidden by the default silent logger.
   * 
   * If this hook throws, the original error is still logged and returned as 500.
   * 
   * @param error - The error thrown during turn processing (may be non-Error value)
   * @param activity - The activity being processed, if available
   */
  onTurnError?: (error: unknown, activity?: CoreActivity) => void | Promise<void>;
}
```

### .NET / Python

**Not required initially.** Both languages already propagate exceptions from their `processBody` equivalents, making errors visible to the HTTP layer. If added later for consistency, the signature should match:

```csharp
// .NET (if added)
public Func<Exception, CoreActivity?, Task>? OnTurnError { get; set; }
```

```python
# Python (if added)
def on_turn_error(self, error: Exception, activity: Optional[CoreActivity] = None) -> None:
    pass
```

## Test Coverage Required

| Scenario | Expected Behavior |
|----------|-------------------|
| Handler throws Error | `onTurnError` called with error and activity; 500 returned |
| Invoke handler throws | `onTurnError` called with BotHandlerException; InvokeResponse 500 |
| Middleware throws | `onTurnError` called with error and activity; 500 returned |
| Non-Error throw | `onTurnError` called with non-Error value (e.g., string); 400/500 returned |
| `onTurnError` itself throws | Original error logged; hook exception logged separately; 500 returned |
| `processBody()` error | Exception propagates normally (no `onTurnError` involvement) |
| 400 validation error | `onTurnError` NOT called (not a turn error) |
| 413 body too large | `onTurnError` NOT called (not a turn error) |
| No hook registered + default logger | Error logged to console.error as fallback |
| No hook registered + custom logger | Error logged via custom logger only |

## Implementation Checklist

- [ ] Add `onTurnError` property to `BotApplication` class
- [ ] Update `processAsync` catch block to call `onTurnError` before returning 500
- [ ] Wrap `onTurnError` invocation in try/catch to prevent hook failures from masking original error
- [ ] Add fallback console.error when no hook registered and using default logger
- [ ] Do NOT call `onTurnError` for 400/413 errors (not turn errors)
- [ ] Update `processBody` JSDoc to clarify it still throws normally (no hook involvement)
- [ ] Add all required test cases (see Test Coverage section)
- [ ] Document as Node-specific behavior in `specs/README.md` "Language-Specific Intentional Differences"

## References

- [specs/protocol.md](../protocol.md) — HTTP contract and error-handling behavior
- [AGENTS.md](../../AGENTS.md) — Behavioral invariants across languages
- Node.js implementation: `node/packages/botas-core/src/bot-application.ts`
