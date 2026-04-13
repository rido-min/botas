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
