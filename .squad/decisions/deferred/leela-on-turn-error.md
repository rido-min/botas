# Decision: Add `onTurnError` Hook for Handler Error Visibility (Node.js)

**Date:** 2025-01-25  
**Decider:** Leela (Lead)  
**Status:** Proposed  
**Scope:** Node.js  
**Tracking:** #328

## Context

User-provided handlers and middleware can throw exceptions during turn processing. In Node.js, these errors are completely invisible to developers by default:

1. Handler/middleware throws (e.g., missing Azure OpenAI credentials)
2. Error wrapped in `BotHandlerException` or propagated as-is
3. Caught in `processAsync` → logged at `debug` level (SILENT by default) → generic HTTP 500 returned
4. Developer sees nothing — no console output, no actionable feedback

**Real-world impact:** Sample `04-ai-langchain-mcp` fails silently when environment variables are missing. Developers have no way to diagnose configuration issues without enabling debug logging.

**Root cause:** Node's `processAsync` HTTP helper swallows all errors and logs them using the debug-based logger, which is off by default. The logger abstraction prevents console output unless explicitly configured.

## Decision

Add an `onTurnError` callback hook to `BotApplication` that gives user code visibility into turn-level errors before they're collapsed into HTTP 500 responses.

### API Surface

```typescript
export class BotApplication {
  /**
   * Optional error handler called before collapsing turn-level errors into HTTP 500.
   * 
   * Provides visibility into handler exceptions, middleware errors, and pipeline failures.
   * If this hook throws, the original error is still logged and returned as 500.
   */
  onTurnError?: (error: unknown, activity?: CoreActivity) => void | Promise<void>;
}
```

### Key Design Choices

| Choice | Decision | Rationale |
|--------|----------|-----------|
| **Placement** | `BotApplication` class property | Matches existing `onActivity` pattern |
| **Signature** | `(error: unknown, activity?: CoreActivity)` | Handles non-Error throws and missing activity |
| **Async support** | `void \| Promise<void>` | Allows async logging/telemetry |
| **Hook failure handling** | Try/catch wrapper, log separately, never throw | Original error always takes precedence |
| **Fallback** | Console.error when no hook + default logger | Improves DX for samples without breaking abstraction |
| **Scope** | All 500 errors in `processAsync` | Handler, middleware, and pipeline errors |
| **Exclusions** | 400/413 errors do NOT call hook | Not turn-level processing errors |

### Cross-Language Parity

**Node.js:** Requires this hook because `processAsync` swallows exceptions.  
**.NET / Python:** Do NOT need this initially — both already propagate exceptions from their `processBody` equivalents, making errors visible at the HTTP layer.

If added to .NET/Python later for consistency, use equivalent signatures:
```csharp
public Func<Exception, CoreActivity?, Task>? OnTurnError { get; set; }
```
```python
def on_turn_error(self, error: Exception, activity: Optional[CoreActivity] = None) -> None:
```

## Consequences

### Positive
- Developers get immediate visibility into handler/middleware errors
- Samples with missing configuration fail loudly instead of silently
- No breaking changes (opt-in callback)
- Preserves logger abstraction (fallback only for default logger)

### Negative
- Node-specific API surface (intentional language difference)
- Hook invocation adds minimal overhead to error path
- Must document and test hook failure scenarios

### Neutral
- Adds 8 test cases to Node test suite
- Requires documentation update in `specs/README.md` under "Language-Specific Intentional Differences"

## Implementation Plan

1. Add `onTurnError` property to `BotApplication` class
2. Update `processAsync` catch block to invoke hook before returning 500
3. Wrap hook invocation in try/catch (log hook exceptions separately)
4. Add console.error fallback for default logger + no hook
5. Ensure 400/413 errors do NOT trigger hook
6. Add all required test cases (8 scenarios)
7. Document as Node-specific behavior

## References

- **Spec:** `specs/future/on-turn-error.md` (rubber-duck critique with all findings)
- **Issue:** #328
- **Implementation:** `node/packages/botas-core/src/bot-application.ts`
- **Behavioral invariants:** `AGENTS.md`
