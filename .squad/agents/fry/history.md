# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **RemoveMentionMiddleware (2026-04-13):** Created `node/packages/botas/src/remove-mention-middleware.ts` — implements `ITurnMiddleware`, strips bot @mentions from `activity.text` by matching `entity.mentioned.id` against `activity.recipient.id`. Exported from package index.
- **Middleware pattern:** Middleware can mutate `activity.text` even though `TurnContext.activity` is a readonly reference — the object properties themselves are mutable. This is by design for middleware like mention-stripping.
- **Test file registration:** New spec files must be added to the `test` script in `node/packages/botas/package.json` — it doesn't use glob patterns.
- **Bot Framework mention entity shape:** `{ type: "mention", mentioned: { id, name }, text: "<at>Name</at>" }` — the `text` field contains the exact string embedded in `activity.text`.

### Cross-language parity (2026-04-13)
- **Amy (.NET):** Created `RemoveMentionMiddleware` class and added `BotApp.Use()` method for deferred middleware registration. MentionBot sample demonstrates usage. 10 tests passing (27 total).
- **Hermes (Python):** Created Protocol-based middleware in `python/packages/botas/src/botas/remove_mention_middleware.py`, uses `entity.model_dump(by_alias=True)` to access mention fields. 8 tests passing (45 total).
- All three ports implement same behavior: strip bot @mentions, case-insensitive, provide samples for user reference.

### Python RemoveMentionMiddleware parity fix (2026-04-13)
- **Cross-assigned fix (Fry for Hermes):** Fixed Python `RemoveMentionMiddleware` per Leela's parity review rejection.
- **Removed name-based matching:** Python was checking `recipient.name` in addition to `appid` and `recipient.id`. Now uses `appid ?? recipient.id` two-stage fallback matching .NET reference.
- **Case-insensitive comparison:** ID matching now uses `.casefold()`, text replacement uses `re.IGNORECASE` flag.
- **Tests:** Added 3 new tests (case-insensitive ID, case-insensitive text, no name-matching). All 48 tests pass, ruff clean.
- **onActivity CatchAll (2026-04-13):** Implemented `onActivity` property on `BotApplication`. When set, it replaces per-type dispatch entirely — uses `this.onActivity ?? this.handlers.get(type)` pattern. Error wrapping reuses the same `BotHandlerException` try/catch. 4 new tests added covering: receives all types, bypasses per-type, wraps errors, fallback when unset.
- **Node test runner:** Tests run via `npm test --workspaces --if-present` (root `npm test` fails because root package.json has no test script).

### Security Audit (2024-01-14)
- **Comprehensive audit completed:** Analyzed 15 source files, 4 test files, 3 samples, and configuration files for security, memory management, async/await, and best practices.
- **Critical findings (2):** Prototype pollution risk in JSON.parse (bot-application.ts:128) and unvalidated JWT issuer selection via token peeking (bot-auth-middleware.ts:32-40). Both require immediate remediation.
- **High findings (3):** Missing rate limiting on token validation, secrets logged in debug mode, unhandled promise rejection in middleware pipeline post-next().
- **Memory management:** Event listener leak potential in BotHttpClient interceptors (line 34-38), global logger state accumulation, JWKS cache never expires.
- **Async/await patterns:** Race condition in TokenManager.getBotToken() (no concurrency protection), missing await on processAsync() in Express sample.
- **TypeScript strictness:** Missing noUncheckedIndexedAccess in tsconfig.json — array/map accesses don't enforce undefined checks.
- **Input validation:** assertCoreActivity() only validates required fields (type, serviceUrl, conversation.id) but not text length, entities array size, or attachments — large payloads pass validation.
- **HTTP client:** No timeout configuration in axios (bot-http-client.ts:29), unlimited request body size in readBody() (bot-application.ts:207-213).
- **Dependencies clean:** npm audit shows zero vulnerabilities across all 399 packages (135 prod + 264 dev).
- **Report location:** Full audit with 26 findings (2 critical, 3 high, 11 medium, 7 low, 3 info) documented in node/AUDIT.md.

### Session Summary (2026-04-13)
- **Audit Result:** Node.js audit completed and logged to `node/AUDIT.md` and `.squad/orchestration-log/2026-04-13T0805-fry-audit.md`.
- **Artifacts:** Orchestration log summarizes comprehensive audit across source, tests, samples, and configuration.
- **Cross-Agent:** .NET and Python audits completed. Coordinating shared concerns: input validation gaps, PII logging, rate limiting, payload size limits. See decisions.md for full context.

### Typing Activity API Review (2026-04-13)
- **Reviewed:** Leela's typing activity API proposal (`.squad/decisions/inbox/leela-typing-api.md`).
- **Verdict:** **REQUEST CHANGES** — `sendTyping()` approved, `onTyping()` rejected for Node.js.
- **Rationale:** Node.js uses `on(type, handler)` Map pattern for ALL activity types. Adding `onTyping()` breaks consistency — we don't have `onMessage()`, `onConversationUpdate()`, etc. Typing is not special enough to warrant a dedicated method.
- **Approved:** `ctx.sendTyping()` convenience method on TurnContext — excellent DX improvement, justified by boilerplate reduction. Return type `Promise<void>` is correct (typing activities are ephemeral).
- **Rejected:** `bot.onTyping(handler)` method — should use existing `bot.on('typing', handler)` or `bot.on(ActivityType.Typing, handler)` for type safety.
- **Cross-language:** .NET and Python can keep their typed methods (`OnTyping()`, `on_typing()`) if desired. Node.js stays consistent with its existing patterns.
- **Resolution:** API approved with amendments in `.squad/decisions/inbox/leela-typing-api-resolved.md`. Implementation ready.

### Typing Activity Implementation (2026-04-13)
- **Implemented:** Typing activity support for Node.js per approved API spec.
- **Changes:**
  - Added `sendTyping(): Promise<void>` to `TurnContext` interface (`turn-context.ts`)
  - Implementation creates typing activity using `CoreActivityBuilder` with routing fields copied from incoming activity
  - No `onTyping()` method added — use existing `on('typing', handler)` pattern
  - Created comprehensive test suite (`typing-activity.spec.ts`) with 8 tests covering both receive and send scenarios
  - Added sample (`node/samples/typing-indicator/`) demonstrating usage
  - Updated `package.json` test script to include new spec file
- **Test Results:** All 69 tests pass (4 new tests for receiving typing, 4 new tests for sendTyping())
- **Key Patterns:**
  - Typing activity type already existed in `ActivityType.Typing` constant
  - Handler registration works with existing `on('typing', handler)` — no new API needed
  - `sendTyping()` sends activity via `app.sendActivityAsync()` — no text or other content fields set
  - BotApp wrapper automatically exposes `sendTyping()` through TurnContext — no changes needed
- **Sample Usage:** `await ctx.sendTyping()` before long-running operations to show typing indicator
- **Cross-Language Status:** Node.js implementation complete. .NET and Python implementations pending.

### P2 Audit Fixes (2026-04-13)
- **Completed:** All 4 P2 audit issues fixed in PR #121, branch `squad/node-p2-fixes`.
- **Issue #93 — Error body sanitization:** `BotHttpClient` no longer leaks raw upstream response bodies in exception messages. Full response body logged at debug level only (`getLogger().debug()`), error message contains only method, URL, and status code.
- **Issue #94 — Negative token cache:** `TokenManager` now caches failed Azure AD token acquisitions for 30 seconds (configurable via `NEGATIVE_CACHE_TTL_MS`). Prevents hammering Azure AD on repeated auth failures. Custom token factory failures are NOT cached (passed through immediately).
- **Issue #95 — Startup validation:** `botAuthExpress()` and `botAuthHono()` now validate `CLIENT_ID` at middleware setup time. Throws immediately with clear error message if missing, instead of failing silently at first request.
- **Issue #97 — MSAL log wiring:** MSAL internal logs now forwarded to botas logger via `msalLoggerOptions()` callback. Maps MSAL log levels (0=Error, 1=Warning, 2=Info, 3=Verbose, 4=Trace) to botas logger methods (error, warn, info, debug, trace). Logs prefixed with `[MSAL]` for easy filtering.
- **Tests:** 8 new tests added in `p2-fixes.spec.ts` covering all 4 issues. All 106 tests pass (99 core + 7 express).
- **Files Changed:**
  - `bot-http-client.ts` — import logger, sanitize error messages, log full body at debug level
  - `token-manager.ts` — add `negativeCache` field, negative caching logic in `getToken()`, `redact()` helper for safe logging, MSAL logger callback wiring
  - `bot-auth-middleware.ts` — startup validation in `botAuthExpress()` and `botAuthHono()`
  - `p2-fixes.spec.ts` — new test file with 8 tests
  - `package.json` — add `p2-fixes.spec.ts` to test script
- **Status:** PR #121 open, awaiting review.
# Node.js Umbrella Audit Fixes Summary (2026-04-14)

## Context
Task was to fix remaining medium and low findings from umbrella issue #76 after P1 PR #132 and P2 PR #121.

## Issues Reviewed

### Already Fixed (skipped)
- #93 - Error body sanitization (P2 PR #121)
- #13 - Error messages leak state (same as #93)

### Fixed in This Session (tested, all 88 tests passed)
Successfully applied and tested the following fixes:

**MEDIUM:**
1. **#89 - JWKS cache never expires:** Added LRU cache with 100-entry max and 1h TTL using `lru-cache` package
2. **#92 - HTTP body size unlimited:** Added 10MB limit in `readBody()` with early abort
3. **#3 - Missing HTTP timeout:** Added 30s timeout to axios client
4. **#4 - ReDoS risk:** Added 200-char limit validation before regex escaping in RemoveMentionMiddleware  
5. **#5 - Event listener leak:** Documented BotHttpClient singleton lifecycle pattern in JSDoc
6. **#7 - Missing await in samples:** Added `await` to `bot.processAsync()` in express sample
7. **#8 - Race condition in token acquisition:** Added promise deduplication map in TokenManager
8. **#9 - noUncheckedIndexedAccess:** Enabled in tsconfig.json, fixed resulting type errors
9. **#10 - Inconsistent error handling:** Added error logging before 500 response
10. **#11 - No input validation:** Added limits for text (100KB), entities (1000), attachments (100)
11. **#15 - No cleanup in finally:** Added `req.destroy()` and `headersSent` check

**LOW:**
14. **#14 - MSAL client map never cleared:** Added documentation explaining single-tenant design

**INFORMATIONAL (skipped as noted in charter):**
- #6 - Global logger state (already documented)
- #12 - HTTPS not enforced (documentation task)
- #16 - ESLint security plugins
- #17 - Test files tsconfig
- #18 - Generic usage stricter

## Technical Changes Made

### Files Modified:
- `bot-auth-middleware.ts` — LRU cache for JWKS
- `bot-application.ts` — body size limit, input validation, error logging, cleanup
- `bot-http-client.ts` — timeout, lifecycle documentation  
- `remove-mention-middleware.ts` — ReDoS mitigation
- `token-manager.ts` — promise deduplication, MSAL map documentation
- `conversation-client.ts` — noUncheckedIndexedAccess fix
- `tsconfig.json` — enabled noUncheckedIndexedAccess
- `samples/express/index.ts` — added await
- `package.json` — added lru-cache ^11.0.3 dependency

### Test Results:
✅ All 88 tests pass (81 core + 7 express)
✅ Build succeeds
✅ No regressions

## Issue
Changes were applied and tested successfully but could not be committed due to git branch management complexity. The work branch `squad/node-umbrella-audit-fixes` exists but changes were lost during branch switching operations.

## Recommendation
Re-apply these fixes manually using this summary as a reference, or extract them from the edit tool calls in the session transcript. All changes have been validated via comprehensive testing.
