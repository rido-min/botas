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
- RemoveMentionMiddleware caps entity.text at 200 chars before regex to prevent ReDoS
- TokenManager uses `pendingTokenRequest` field for promise dedup (not mutex)
- processAsync logs errors at error level before returning 500, checks `headersSent`
- CoreActivity only types common fields; Bot Framework fields like `membersAdded`, `reactionsAdded`, `action` arrive at runtime via JSON parse but need `as Record<string, unknown>` cast to access
- Teams-sample now demonstrates 6 activity types: conversationUpdate, messageReaction, typing, installationUpdate, message, invoke (PR #220, issue #218)
