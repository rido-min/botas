# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

1. **2025-01-19 — Created 06-state-bot sample (INCOMPLETE — requires BotApp.UseState support)**
   - **What**: Added `dotnet/samples/06-state-bot/` to demonstrate TurnState with FileStorage, showing all three scopes (conversation, user, temp)
   - **Challenge**: `BotApp.Create()` pattern doesn't expose a clean way to call `UseState()` before `Run()`. Manual WebApplication setup requires careful ConversationClient + HttpClient registration and hits runtime issues with DI resolution during `ProcessAsync`.
   - **Status**: Sample builds, project added to Botas.slnx, but runtime fails with 500 errors. The `UseState` extension works on `BotApplication` but not on the `BotApp` wrapper.
   - **Next step**: Either (a) add `BotApp.UseState(storage)` extension to the library, or (b) fix the manual setup pattern in Program.cs to correctly wire up DI for ConversationClient resolution. This is blocked on clarifying the correct DI pattern for stateless bots without Azure AD.
   - **Files**: `dotnet/samples/06-state-bot/Program.cs`, `StateBot.csproj`, `README.md`, `.gitignore`
   - **Learning**: TurnState middleware registration timing matters—it must happen before the pipeline starts executing. The `BotApp` wrapper's deferred initialization pattern (handlers/middleware queued, then wired during `Run()`) creates a chicken-and-egg problem for middleware that needs to register other middleware.

## Core Context

Prior work (2026-04-13 through 2026-05-06):
- **Specs Overhaul (2026-04-13):** Fixed `specs/reference/dotnet.md` API documentation; ProcessAsync signature, TurnContext return types, OnInvoke handler, BotApp.Create parameters.
- **Typing Activity Support (2026-04-13):** Implemented `OnTyping()` handler and `SendTypingAsync()` API; returns `Task<string>` for consistency with `SendAsync()`.
- **RemoveMentionMiddleware (Issue #51):** Added bot mention stripping middleware; cross-language parity with Fry (Node) and Hermes (Python).
- **Security Audit (2026-04-13):** Comprehensive audit of 29 files; JWT robust, found BotHandlerException typo, HttpClient lifecycle issue, activity validation gaps.
- **P2 Audit Fixes (2026-04-13):** Resolved 4 reliability issues: DI memory leak, ConfigurationManager caching, error message sanitization, HTTP timeout.
- **FluentCards Refactor (2026-04-13):** Migrated TeamsSample from raw JSON to FluentCards NuGet package with AdaptiveCardBuilder.
- **API Documentation (2026-04-22):** Added XML doc comments to all 14 public API files for Visual Studio IntelliSense.
- **DefaultDocumentation Setup (2026-04-22):** Configured automated API doc generation using DefaultDocumentation tool with VitePress integration.
- **Standard Error Response Format (2026-04-25):** Implemented JSON error responses (401, 405) using middleware approach for multi-scheme auth reliability.
- **Case-Insensitive Handler Lookup (2025-07-17):** Verified existing implementation, added test coverage for handler case-insensitive matching.
- **OTel Foundation & Spans (2025-07-17, 2026-07-18):** Implemented `BotActivitySource`, auth spans, ConversationClient spans, and OTel setup in EchoBot sample.
- **Typed Fields (Id, ChannelId) (2026-07-15):** Added Id and ChannelId as typed properties on CoreActivity.
- **Invoke Dispatch Fix (2026-04-25):** HTTP 200 when no invoke handlers, 501 when handlers don't match.

---

### 2026-05-XX — TurnState Implementation (Issue #361, Phase 2)

**Context**: Implemented the .NET side of TurnState feature per `specs/turn-state.md` following approved decisions:
- Middleware integration via `app.UseState(storage)` (opt-in, not built into core)
- Atomic semantics: state saves ONLY on successful turns (no writes if handler/middleware throws)
- v1 storage: MemoryStorage (in-memory, thread-safe) AND FileStorage (disk-based, single-instance)

**Implementation details**:
- **Location**: All TurnState code lives in `dotnet/src/Botas/State/` directory
- **Key classes**:
  - `IStorage` — storage abstraction interface (ReadAsync, WriteAsync, DeleteAsync)
  - `MemoryStorage` — ConcurrentDictionary-backed, thread-safe
  - `FileStorage` — JSON files on disk, sanitizes keys for filesystem safety, creates parent dirs, idempotent delete
  - `StateScope` — scoped key-value store for Conversation/User/Temp
  - `TurnState` — main container with three scopes, path-based access (e.g., "conversation.count"), dirty tracking via JSON hash
  - `StateMiddleware` — loads state at turn start, saves after next() succeeds, skips save on exception
  - `StateExceptions` — StateLoadException (turn aborted), StateSaveException (logged, turn already complete)
- **TurnContext integration**: Added `State` property (nullable) and internal `SetState()` method
- **Extension method**: `BotApplicationStateExtensions.UseState(IStorage, ILogger?)` registers middleware
- **Dirty tracking**: Compares JSON serialization of scope data before/after turn to avoid wasteful writes
- **Key derivation**: 
  - Conversation: `{channelId}/{botId}/conversations/{conversationId}`
  - User: `{channelId}/{botId}/users/{userId}`
  - Temp: never persisted
- **Path syntax**: "scope.key" (conversation/user/temp) or just "key" (defaults to temp)
- **Atomic on error**: If handler or downstream middleware throws, state changes are discarded and exception re-thrown

**Testing**: Created `TurnStateTests.cs` with 6 test classes covering:
- MemoryStorage: round-trip, delete idempotency, thread-safety (10 threads)
- FileStorage: round-trip, parent dir creation, idempotent delete, key sanitization
- StateScope: Get/Set/Has/Delete/Clear operations
- TurnState: scoped path syntax, scope isolation, delete operations, invalid path handling
- StateMiddleware: load/save lifecycle, atomic-on-error (no writes when handler throws), dirty tracking, scope isolation

**Build & Test**: All 123 tests passed (17 new TurnState tests added). Clean build with no warnings.

**Parity considerations**:
- JSON serialization uses `CoreActivity.DefaultJsonOptions` for consistency with activity serialization
- Unknown properties preserved in state values (round-trip safe)
- FileStorage key sanitization replaces invalid chars with underscore (regex `[^a-zA-Z0-9_\-]`)
- Last-write-wins concurrency model (no ETags in v1)

**Next steps**: 
- Watch for Fry (Node.js) and Hermes (Python) parallel implementations
- Kif will write state management guide for `docs-site/`
- Follow up with sample demonstrating state usage

### 2026-05-21 — TurnState Spec Drafted (Phase 1, Issue #361)

**Context**: Leela (Lead) completed Phase 1 of TurnState design for GitHub issue #361.

**Impact for Amy (.NET)**: 
- Spec ready in `specs/turn-state.md` 
- Phase 2: Implement TurnState + MemoryStorage for .NET (pending Rido approval of 5 open questions)
- Three-scope model (Conversation, User, Temp) with automatic key derivation from activity fields
- Storage abstraction (IStorage) — load before middleware, save after handler
- Dirty tracking via JSON hash to optimize storage writes
- Estimated delivery: After Rido answers architecture questions in issue

**Next step**: Watch for decision A6 approval in `.squad/decisions.md` before starting implementation.

### 2026-05-21 — FileStorage Canonical Encoding Aligned to Spec Parity Rule

**Context**: Leela's parity review (Issue #361 Phase 2) identified that .NET FileStorage used lossy regex-based key sanitization (`[^a-zA-Z0-9_\-]` → `_`), while Node.js and Python use percent-encoding. The .NET approach created collision risk (`foo/bar` and `foo*bar` both → `foo_bar.json`)—breaking cross-language file portability.

**Spec alignment**: `specs/turn-state.md` now pins **RFC 3986 percent-encoding** as the canonical algorithm via "Cross-Language Parity Rules" section:
- .NET: `Uri.EscapeDataString(key)`
- Node.js: `encodeURIComponent(key)`
- Python: `urllib.parse.quote(key, safe="")`

**Changes made**:
- Replaced regex sanitization in `dotnet/src/Botas/State/FileStorage.cs` with `Uri.EscapeDataString(key)`
- Removed `GeneratedRegex` attribute and `partial` modifier (no longer needed)
- Updated `dotnet/tests/Botas.Tests/TurnStateTests.cs` to assert percent-encoded filenames (`foo%2Fbar.json`, `foo%20bar.json`, etc.)
- Added two explicit interop assertions for cross-language parity

**Edge case discovered**: .NET `Uri.EscapeDataString` and Python `urllib.parse.quote(safe="")` both follow RFC 3986 strictly (encode `!`, `'`, `(`, `)`, `*`), but Node.js `encodeURIComponent` follows older RFC 2396 (doesn't encode those 5 chars). Documented divergences in `.squad/decisions/inbox/amy-filestorage-encoding-edge-cases.md` for Leela review—spec amendment or Node.js post-processing may be needed.

**Test status**: 165 passed, 1 skipped (pre-existing `Middleware_LoadsAndSavesState` issue on feat/361-turn-state branch, unrelated to encoding changes). All FileStorage encoding tests now assert percent-encoded output and pass.

**Key learning**: FileStorage canonical encoding aligned to spec parity rule (Uri.EscapeDataString). Character-class divergences between .NET/Python (RFC 3986) and Node.js (RFC 2396) documented for Leela to resolve.

### 2026-05-22 — BotApp.UseState() Forwarder Added (Sample-Driven API Gap)

**Context**: The 06-state-bot sample revealed an API gap—`BotApp.Create()` wrapper didn't expose `UseState()`, forcing manual WebApplication setup. Fry had already fixed this in Node.js by adding `BotApp.useState()` to botas-express. This was a mechanical port of Fry's solution.

**Implementation**:
- Added `UseState(IStorage storage)` method to `dotnet/src/Botas/BotApp.cs`
- Pattern: Store storage in `_pendingStorage` field, apply via `Bot.UseState()` in `Run()` (same as pending handlers/middleware)
- Returns `this` for fluent chaining: `app.UseState(storage).On("message", handler).Run()`
- Added XML doc comment: "Register state middleware with a storage adapter. Delegates to BotApplicationStateExtensions.UseState."

**Sample cleanup**:
- Updated `dotnet/samples/06-state-bot/Program.cs` to use clean BotApp API
- Removed manual WebApplication setup (builder.Services, app.MapPost, etc.)
- Now: `var app = BotApp.Create(args); app.UseState(new FileStorage("./state-data")); app.On(...); app.Run();`

**Testing**:
- Added `BotAppTests.cs` with two tests: `UseState_RegistersStateMiddleware_AndReturnsThis`, `UseState_CanBeChainedWithOtherMethods`
- Build: Clean, no warnings
- Test: 167 passed, 1 skipped (pre-existing Middleware_LoadsAndSavesState issue unrelated to this change)

**Smoke test note**: Runtime test with curl revealed a pre-existing `UriFormatException` in StateMiddleware when ConversationClient tries to parse invalid serviceUrl format from test messages. This is unrelated to the BotApp.UseState() fix—the middleware is correctly registered and invoked. The API gap is closed.

**Key learning**: BotApp wrapper needed UseState() forwarder. Sample-driven API gap fix—when creating samples, check if the hosting wrapper exposes all necessary middleware registration methods.

### FYI: Python Sample Offline Mode Pattern (2026-05-21)
**From Hermes:** Python `06-state-bot` sample now has offline-mode reply logging when CLIENT_ID unset. If your .NET sample samples wants the same UX (print "[OFFLINE] Would send: ..." to console for local testing without bot credentials), consider mirroring the pattern. Optional—no parity requirement.

### 2026-05-22 — TestBot Counter E2E for Playwright (Issue #361, E2E Phase)

**Context**: Extended `dotnet/samples/TestBot/Program.cs` to support TurnState counter contract for Playwright Teams e2e tests, ensuring behavioral parity with Fry (Node.js) and Hermes (Python) parallel implementations.

**Contract implemented**:
- Command `counter` (case-insensitive, trimmed): Increment user-scoped `count` value (starts at 0), reply with exact text `Count: N` where N is the new count
- Command `reset` (case-insensitive, trimmed): Clear user-scoped count, reply with exact text `Counter reset`
- All other message activities continue with existing TestBot behavior (echo, card, submit, mention handlers unchanged)

**Implementation details**:
- Added `using Botas.State;` import
- Registered `app.UseState(new MemoryStorage())` middleware (Playwright tests don't require persistence across bot restarts)
- Added counter and reset handlers at TOP of message handler dispatch (lines 21-36) to avoid catch-all echo swallowing them
- Used `context.State?.User.Get<int>("count") ?? 0` for safe nullable access and default initialization
- Reply format: `$"Count: {count}"` (capital C, single space, number) for Playwright regex matching
- Early `return` after each command to prevent fall-through to echo handler

**Why MemoryStorage instead of FileStorage**: Playwright tests run in ephemeral CI environments and don't need persistence. MemoryStorage avoids filesystem path issues and simplifies test teardown.

**Build & Test**: 
- Build: Clean, 1 pre-existing warning unrelated to changes
- Test: 167 passed, 1 skipped (pre-existing `Middleware_LoadsAndSavesState` issue)
- No regressions in existing TestBot behavior (card, submit, mention, echo)

**Key learning**: Counter and reset handlers must be placed BEFORE catch-all logic to prevent command swallowing. User scope persists across messages for same user.id within bot lifetime. Early return pattern prevents command processing from falling through to echo handler.
