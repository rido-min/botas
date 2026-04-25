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

- RemoveMentionMiddleware caps entity.text at 200 chars before regex to prevent ReDoS
- TokenManager uses `pendingTokenRequest` field for promise dedup (not mutex)
- processAsync logs errors at error level before returning 500, checks `headersSent`
- CoreActivity only types common fields; Bot Framework fields like `membersAdded`, `reactionsAdded`, `action` arrive at runtime via JSON parse but need `as Record<string, unknown>` cast to access
- Teams-sample now demonstrates 6 activity types: conversationUpdate, messageReaction, typing, installationUpdate, message, invoke (PR #220, issue #218)
- JSDoc coverage added to all 11 non-spec source files in `node/packages/botas/src/` for issue #224; build + 112 tests pass clean

### Error Response JSON Format (2026-04-25)
- **Standardized 401 auth error responses** to return JSON `{ error: 'Unauthorized', message: '<specific error>' }` instead of plain text
- Updated `ExpressResponse` type to include `json()` method for proper Content-Type headers
- Added 2 tests verifying JSON error format on missing header and invalid token scenarios
- No `botas-hono` package exists — only Express adapter needed changes
- 405 handling lives on separate branch `fix/node-get-405` (PR #255) — not modified here
- **PR:** #257 — Fixes #247 (Node.js part)

### Node.js Specs Overhaul (2026-04-25)
- **Fixed `specs/reference/node.md` for accuracy vs. implementation:**
  - Corrected import paths: `botas` → `botas-core` (core API) and `botas-express` (Express adapter)
  - Clarified `botAuthHono` is NOT exported; users must import `validateBotToken` + `BotAuthError` from `botas-core` and write custom middleware
  - Added `onInvoke()` method to BotApplication class signature (invoke handlers return InvokeResponse)
  - Updated configuration table: `TENANT_ID` defaults to `"botframework.com"` (not `"common"`), added `ALLOWED_SERVICE_URLS` env var for SSRF protection
  - Added `MANAGED_IDENTITY_CLIENT_ID` to configuration table
  - Updated Language-Specific Differences table to reflect `validateBotToken()` as the auth import for custom middleware
  - Replaced `botAuthHono()` import example with complete custom middleware implementation in Hono sample
  - Added new `validateBotToken()` section explaining direct use for non-Express frameworks
- **Auth library confirmed:** `jose` (not `jsonwebtoken` + `jwks-rsa`)
- **Key audit finding:** `botAuthHono` is sample code only, not an exported library function
- **Issue:** #259 (docs/specs-overhaul-259)

### Invoke Dispatch Fix (2026-04-25)
- **Fixed `dispatchInvokeAsync`** to distinguish between zero invoke handlers (return 200 {}) vs handlers exist but none match (return 501)
- Key change in `bot-application.ts`: check `this.invokeHandlers.size > 0` before returning 501
- Return type changed from `Promise<InvokeResponse>` to `Promise<InvokeResponse | undefined>` — undefined means 200 {}
- Updated 2 existing tests and added 2 new tests (4 invoke dispatch tests total covering all branches)
- All 114 core tests pass clean
- **Branch:** `fix/invoke-dispatch-262` — Fixes #262
### Case-Insensitive Handler Lookup (2026-04-25)
- **Made activity type handler lookup case-insensitive** in `bot-application.ts` (issue #263)
- Normalized keys to lowercase on both registration (`on()`, `onInvoke()`) and lookup (`handleCoreActivityAsync`, `dispatchInvokeAsync`)
- Added 2 tests: "Message" registration matches "message" activity, "typing" registration matches "Typing" activity
- All 126 tests pass across all workspaces (114 botas-core + 12 botas-express), 0 failures
- **Branch:** `fix/case-insensitive-handler-lookup-263`
### Promote id and channelId to typed CoreActivity fields (2026-04-25)
- **Added `id` and `channelId`** as optional string properties on `CoreActivity` interface in `node/packages/botas-core/src/core-activity.ts`
- Node.js uses plain TypeScript interfaces + `JSON.parse` — no custom fromJson/toJson logic needed; adding to the interface is sufficient
- Added 4 tests: typed deserialization, not-in-properties check, JSON round-trip, missing-fields graceful handling
- All existing tests still pass; build clean
- **Issue:** #261 (fix/typed-id-channelid-261)

