# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Core Context

### Key Files

- `node/packages/botas/src/` — Core library (bot-application.ts, bot-auth-middleware.ts, middleware, turn-context.ts)
- `node/packages/botas/src/remove-mention-middleware.ts` — Strip bot mentions from activity text
- `node/packages/botas-express/` — Express framework adapter
- `node/samples/` — Sample bots (echo, teams-sample, typing-indicator)
- `node/AUDIT.md` — Security audit findings (26 items: 2 critical, 3 high, 11 medium, 7 low, 3 info)

### Team Updates (2026-05-21)

**TurnState Spec Ready (Issue #361 Phase 1)**:
- Leela drafted `specs/turn-state.md` with three-scope state model, storage abstraction, and lifecycle design
- **Your next task**: Implement TurnState + MemoryStorage for Node.js (Phase 2, pending Rido approval)
- Decision A6 captures open questions for architecture sign-off in `.squad/decisions.md`

### Patterns & Conventions

- **Middleware pattern:** Implements `ITurnMiddleware`, mutates `activity.text` in-place (readonly reference allows property mutation)
- **Mention entity shape:** `{ type: "mention", mentioned: { id, name }, text: "<at>Name</at>" }`
- **Test registration:** Spec files must be added to `node/packages/botas/package.json` test script (no glob patterns)
- **onActivity fallback:** `this.onActivity ?? this.handlers.get(type)` pattern for CatchAll dispatch
- **TypeScript strictness:** `noUncheckedIndexedAccess` enabled; array/map accesses require undefined checks
- **FluentCards:** Adaptive Cards use `fluent-cards` npm package with `AdaptiveCardBuilder` + `toJson(card)` → JSON string

### Resolved Issues

- **RemoveMentionMiddleware parity:** Fixed Python version (Fry) to match .NET; removed name-based matching, added case-insensitive ID/text
- **P1 security fixes:** JWKS cache TTL + eviction (24h, 100 max), HTTP timeouts (30s), SSRF prevention (serviceUrl allowlist), body size limit (256KB)
- **P2 security fixes:** Error body sanitization (debug-level logging), negative token cache (30s), startup validation (CLIENT_ID check), MSAL log wiring
- **Typing activity:** Added `sendTyping(): Promise<void>` to TurnContext; no `onTyping()` method (use `on('typing', handler)` pattern)
- **FluentCards adoption:** Refactored teams-sample to use fluent builders (cross-language parity with .NET, Python)

### Current State

- **Test coverage:** 88 tests pass (81 core botas + 7 express); all new features covered
- **Build status:** TypeScript clean, eslint compliant, npm audit: zero vulnerabilities (399 packages)
- **Latest work:** Node.js umbrella audit fixes applied + tested (11 MEDIUM + 1 LOW), changes lost during branch operations
- **Open PRs:** #132 (P1 fixes), #121 (P2 fixes), #139 (umbrella fixes)

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### A8 (Redis): Added botas-redis Workspace Package + RedisStorage Implementation (PR #363) — 2026-05-22
- **What**: Implemented RedisStorage for Node.js, a new optional state storage backend for TurnState (Issue #361 Phase 3).
- **Scope**: New `botas-redis` npm workspace package. Dependency: `redis@^4.7.0`.
- **Implementation**: `src/redis-storage.ts` with:
  - Constructor overloads: `RedisStorage(redisUrl: string)` and `RedisStorage(client: RedisClientType)`
  - Implements `IStorage` interface (readAsync, writeAsync, deleteAsync)
  - Pipelined per-key GET/SET/DEL operations (Redis Cluster safe — no MGET/MSET/multi-key DEL)
  - Configurable key prefix (default: `botas:`)
  - No TTL in v1 — state persists until explicit delete
- **Testing**: Created `src/redis-storage.spec.ts` with 10 tests: 9 unit tests (FakeRedisClient mock, no external Redis required) + 1 integration test (skipped unless REDIS_URL env var set). Coverage: init, get, set, delete, key-value round-trip, error paths.
- **Sample**: Added `node/samples/07-redis-state-bot/` demonstrating stateless hosting with Redis backend. Uses process signal handlers for graceful SIGINT shutdown.
- **Cross-language coordination**: Parallel implementations shipped with Amy (.NET `Botas.Redis` NuGet with `StackExchange.Redis 2.8.16`) and Hermes (Python `botas.state.RedisStorage` with lazy `redis.asyncio` import). All three follow same pipelining pattern for Cluster compatibility and use same key format.
- **Key decision**: RedisStorage ships as separate npm workspace (mirrors .NET separate NuGet, Python `[redis]` extra). Ecosystem-native pattern enables independent versioning.
- **Test results**: 9 passing unit tests + 1 skipped integration test + 192 core tests = 201 total. No regressions.
- **Learning**: Constructor overloads (URL vs. existing client) reduce setup friction for users. Pipelined per-key ops + key format coordination across three languages ensures production-safe Redis deployment patterns (standalone + Cluster). Lazy integration tests (REDIS_URL gate) allow CI to run without external Redis dependency.

- Middleware can mutate activity properties even via readonly context reference
- CatchAll onActivity handler bypasses per-type dispatch entirely with clean fallback pattern
- Promise deduplication prevents concurrent Azure AD token acquisition races
- `noUncheckedIndexedAccess` enabled in tsconfig; array/map accesses need `!` or `?? fallback`
- Activity input validation enforces: text ≤50K, entities ≤100, attachments ≤50 (assertCoreActivity)

### API Documentation — JSDoc/TSDoc (2026-04-22)
- **Added JSDoc/TSDoc comments to all 11 public API files** in `node/packages/botas/src/` per user directive (Rido, 2026-04-22T21:27).
- **Files documented:**
  - Core API: `bot-application.ts`, `bot-app.ts`, `turn-context.ts`
  - Models: `core-activity.ts`, `core-activity-builder.ts`, `channel-account.ts`, `attachment.ts`
  - Utilities: `conversation-client.ts`, `remove-mention-middleware.ts`, `iturn-middleware.ts`, `bot-handler-exception.ts`
- **Style:** JSDoc format with TypeScript type annotations (`@param {Type}`, `@returns {Promise<Type>}`, `@throws`)
- **Impact:** API documented for VS Code IDE tooltips; TypeDoc can generate Markdown reference docs
- **Cross-language coordination:** .NET (XML) and Python (docstrings) also documented in parallel session
- **Test status:** All 112 tests pass
- **PR:** #225 (consolidated with Amy/Hermes docs) — Fixes #224

### TurnState Implementation (2026-05-21, Issue #361 Phase 2)
- **Implemented TurnState feature per `specs/turn-state.md`** with three-scope state model, storage abstraction, and atomic-on-error semantics
- **Files added:**
  - `node/packages/botas-core/src/state/storage.ts` — Storage interface
  - `node/packages/botas-core/src/state/memory-storage.ts` — In-memory storage (Map-backed, deep-clone isolation)
  - `node/packages/botas-core/src/state/file-storage.ts` — File-based storage (JSON files, `encodeURIComponent` key sanitization)
  - `node/packages/botas-core/src/state/state-scope.ts` — StateScope interface + implementation with dirty tracking
  - `node/packages/botas-core/src/state/turn-state.ts` — TurnState + key derivation (`{channelId}/{botId}/conversations/{conversationId}`)
  - `node/packages/botas-core/src/state/index.ts` — Barrel export
- **Integration:**
  - Added `BotApplication.useState(storage)` method to register state middleware
  - Updated `TurnContext` interface with optional `state?: TurnState` property
  - Modified `runPipelineAsync` to load state before middleware, save after successful pipeline execution
  - Atomic semantics: state saves ONLY if handler/middleware chain completes without throwing
- **Test coverage:** 35 new tests (memory-storage: 7, file-storage: 7, turn-state: 12, bot-state-integration: 9)
- **All 187 botas-core tests pass + 12 botas-express tests = 199 tests total, 100% pass rate**
- **Key design decisions:**
  - Path encoding: `encodeURIComponent(key)` for cross-language parity with .NET
  - Test framework: Node built-in test runner (`node:test` + `node:assert/strict`), not Jest
  - Dirty tracking: JSON.stringify hash comparison to avoid wasteful storage writes
  - Temp scope: Never persisted, resets every turn

- RemoveMentionMiddleware caps entity.text at 200 chars before regex to prevent ReDoS
- TokenManager uses `pendingTokenRequest` field for promise dedup (not mutex)
- processAsync logs errors at error level before returning 500, checks `headersSent`
- CoreActivity only types common fields; Bot Framework fields like `membersAdded`, `reactionsAdded`, `action` arrive at runtime via JSON parse but need `as Record<string, unknown>` cast to access
- Teams-sample now demonstrates 6 activity types: conversationUpdate, messageReaction, typing, installationUpdate, message, invoke (PR #220, issue #218)
- JSDoc coverage added to all 11 non-spec source files in `node/packages/botas/src/` for issue #224; build + 112 tests pass clean

### 2026-05-21 — Playwright E2E Mention Test Divergence (Issue #361, E2E Phase)

**Context**: Nibbler executed Playwright e2e tests on feat/361-turn-state branch. Node.js tests: 4/5 passed (Counter/TurnState working), but 1 mention test failed.

**Finding**:
- **Test expectation**: `text.startsWith('mention')` — handler should receive activity text starting with "mention"
- **Handler reality**: Text is `@EchoBot hello` (full bot mention prefix intact, not stripped)
- **Root cause**: RemoveMentionMiddleware may not be stripping mention prefix in Playwright test context, or timing/ordering issue with middleware pipeline
- **Not TurnState-related**: Counter tests (4/5) pass, so state feature works. Divergence is specific to mention entity handling.

**Cross-language context**:
- Spec says: RemoveMentionMiddleware should remove mention prefix when bot is mentioned
- Amy (.NET) and Hermes (Python) startup failures (different issue) prevent their mention tests from running
- Only Node.js mention test revealed this divergence

**Likely root causes**:
1. RemoveMentionMiddleware not invoked or not matching mention entity correctly in test
2. Activity arriving without mention entity (payload mismatch between e2e bot and test)
3. Regex or mention-text comparison logic failing under test conditions
4. Middleware execution order or early return preventing mention stripping

**Impact**: Mention handling test blocked. E2E mention integration not verified.

**Next step**: Debug RemoveMentionMiddleware execution in e2e context. Verify mention entity structure in test-bot payload. Check middleware pipeline ordering and execution log.

### 06-state-bot Sample Creation (2026-05-21, Issue #361 Phase 3)
- **Created `node/samples/06-state-bot/`** to demonstrate TurnState feature with FileStorage
- **Structure mirrors 01-echo-bot**: package.json, tsconfig.json, index.ts, README.md, .gitignore
- **Bot behavior** (parity with Amy/Hermes):
  - Increments `turn_count` in conversation scope
  - Tracks `user_message_count` in user scope per-user
  - Uses temp scope for per-turn formatted reply
  - Special commands: `reset` (clears conversation state), `whoami` (echoes user stats)
  - FileStorage with `./state-data` directory (percent-encoded filenames)
- **BotApp.useState() method added** to botas-express (delegates to BotApplication.useState)
- **README** includes curl examples, state file inspection guide, cross-language parity notes
- **Build clean**: All 203 tests pass (191 botas-core + 12 botas-express), typecheck passes for all samples including 06-state-bot
- **Smoke test outcome**: State loading/setting works correctly (verified in debug output). State persists only on successful turn per atomic semantics (spec-compliant). Sample requires valid CLIENT_ID/CLIENT_SECRET to send replies via Bot Service API (same as all bot samples).
- **Key files**: `node/samples/06-state-bot/index.ts`, `node/packages/botas-express/src/bot-app.ts` (useState method), README.md with usage guide

### FYI: Python Sample Offline Mode Pattern (2026-05-21)
**From Hermes:** Python `06-state-bot` sample now has offline-mode reply logging when CLIENT_ID unset. If your Node.js sample wants the same UX (print "[OFFLINE] Would send: ..." to console for local testing without bot credentials), consider mirroring the pattern. Optional—no parity requirement.

### test-bot TurnState Counter Feature (2025-01-26, Issue #361 E2E Test Prep)
- **Added TurnState-powered counter commands to `node/samples/test-bot/index.ts`** for Playwright E2E testing
- **Commands added:**
  - `counter` (case-insensitive): Increments user-scoped count, replies `Count: N` (exact format for regex matching)
  - `reset` (case-insensitive): Clears user scope count, replies `Counter reset`
- **State storage:** MemoryStorage (no persistence needed for E2E tests)
- **Integration:** Added `app.useState(new MemoryStorage())` and imported `MemoryStorage` from botas-core
- **Placement:** Counter/reset handlers placed BEFORE catch-all echo handler to ensure precedence
- **Contract alignment:** Matches Amy (.NET) and Hermes (Python) implementations for cross-language E2E parity
- **Build status:** Clean build, all 203 tests pass (191 botas-core + 12 botas-express), no regressions
- **Key insight:** TurnState user scope provides per-user persistence across messages; count state survives across conversation turns

### 2026-05-22 — Cross-Language MemoryStorage Deep-Clone Parity (PR #362)

**Team Context**: Amy (.NET) and Hermes (Python) identified and fixed atomic-on-error violations in MemoryStorage where direct object references were leaked on exception. Decision captured: **All three languages now deep-clone on read/write.**

- **.NET** uses JSON round-trip via `CoreActivity.DefaultJsonOptions` (`JsonSerializer.Serialize` → `JsonSerializer.Deserialize<object>`)
- **Python** uses `copy.deepcopy()` for deep-clone isolation
- **Node.js** (your implementation) currently uses `structuredClone()` — **verify this matches semantic** (deep-clone semantics should be consistent across all 3)

**Impact**: If your Node.js MemoryStorage does NOT deep-clone, this is a bug matching Amy/Hermes findings. Implementation status unknown—Fry's PR #361 checklist may not have included this. Consider adding deep-clone if missing.

**Reference**: `.squad/decisions.md` entry 81, `amy-pr362-deepclone.md` decision document.
