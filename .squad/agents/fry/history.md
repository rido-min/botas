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

