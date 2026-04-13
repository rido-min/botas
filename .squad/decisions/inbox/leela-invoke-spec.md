# Decision: Invoke Activities Spec

**Author:** Leela (Lead) | **Status:** Proposed (awaiting implementation) | **Issue:** #78

## Summary

Wrote comprehensive spec at `specs/invoke-activities.md` defining how invoke activities are dispatched, how handlers return values, and the cross-language API surface.

## Key Design Decisions

### 1. Invoke Handlers Return InvokeResponse

Unlike standard activity handlers (which return void), invoke handlers MUST return an `InvokeResponse { status, body? }`. The framework writes this to the HTTP response body instead of `{}`.

**Rationale:** The Bot Framework protocol requires invoke activities to produce a synchronous response body. This is the core architectural difference from other activity types.

### 2. Two-Level Registration: onInvoke("name", handler)

New `onInvoke("name", handler)` API dispatches by invoke name (e.g., `"adaptiveCard/action"`, `"task/fetch"`). This is separate from the existing generic `on("invoke", handler)`.

**Rationale:** Most bots handle multiple invoke types differently. Name-based dispatch avoids a giant switch statement inside a single catch-all handler.

### 3. Mutual Exclusion: CatchAll vs Specific

Registering a catch-all `onInvoke(handler)` and specific `onInvoke("name", handler)` at the same time raises an error at registration time.

**Rationale:** Follows the Teams.net reference pattern. Prevents ambiguous dispatch where it's unclear which handler wins.

### 4. 501 Default for Unhandled Invokes

When no handler matches an invoke name, return `InvokeResponse(501)` — NOT silent ignore.

**Rationale:** Invoke activities require a response. Silent ignore would cause the channel to time out. The 501 "Not Implemented" is the Teams.net convention.

### 5. Backward Compatibility with on("invoke", ...)

Existing `on("invoke", handler)` continues to work as a generic invoke handler. If both `on("invoke", ...)` and `onInvoke(...)` are registered, the specific `onInvoke` takes precedence.

## Cross-Language API

| Concern | .NET | Node.js | Python |
|---------|------|---------|--------|
| Specific invoke | `app.OnInvoke("name", handler)` | `app.onInvoke("name", handler)` | `@app.on_invoke("name")` |
| CatchAll invoke | `app.OnInvoke(handler)` | `app.onInvoke(handler)` | `@app.on_invoke()` |
| Return type | `Task<InvokeResponse>` | `Promise<InvokeResponse>` | `InvokeResponse` |
| Response type | `InvokeResponse` class | `InvokeResponse` interface | `InvokeResponse` dataclass |

## Implementation Order

1. All languages: Add `InvokeResponse` type
2. All languages: Add `onInvoke("name", handler)` and catch-all `onInvoke(handler)` registration
3. All languages: Modify pipeline to detect invoke and write InvokeResponse to HTTP response
4. QA: Tests for dispatch, return value propagation, 501 default, mutual exclusion

## References

- Spec: `specs/invoke-activities.md`
- Teams.net reference: `TeamsBotApplication.cs`, `Router.cs`, `InvokeActivity.cs`
- Issue: #78
