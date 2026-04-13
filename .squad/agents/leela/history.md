# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **2026-04-13: CatchAll handler spec defined for cross-language parity.** .NET has `OnActivity` property on `BotApplication` that replaces per-type handler dispatch when set. Spec now formally defines this behavior for all three languages: CatchAll handler is optional; when set, it bypasses all per-type handlers; exceptions wrapped in `BotHandlerException`; unregistered types still silently ignored. Language-specific naming: `OnActivity` (.NET), `onActivity` (Node.js), `on_activity` (Python). Updated specs/protocol.md and specs/README.md. Decision: .squad/decisions/inbox/leela-catchall-spec.md
- **2026-04-13: Docs-site technical accuracy review.** Found and fixed 6 issues: wrong method name in README (.NET `CreateReply` → `CreateReplyActivity`), wrong package name in README (Node `@botas/botas` → `botas`), phantom `express.json()` middleware in README, broken Python uvicorn run path in README and getting-started (samples/ dir not inside packages/botas/), false `ChannelId`/`channelId` claims in dotnet.md and python.md (createReplyActivity does NOT copy channelId in any language — only copies serviceUrl and conversation).
- **2026-04-13: Docs folder reorganized.** Kif moved `docs/specs/` → `specs/`, `docs/Architecture.md` + `docs/Setup.md` → `specs/`, `docs/art/` → `art/` at repo root. `docs/` directory deleted. `docs-site/` (Jekyll) remains. All cross-references updated. Future doc references should use `specs/` and `art/` paths.
- **Spec-vs-implementation gap:** AGENTS.md behavioral invariant #2 says createReplyActivity "MUST copy channelId and set replyToId" but NO language implementation does this. The .NET CoreActivity class doesn't even have a typed `ChannelId` property. Docs now match implementation, not spec. This gap should be resolved: either update the implementations or update AGENTS.md.
- **Trace/invoke skip is .NET-only:** ConversationClient.SendActivityAsync in .NET silently skips `trace` and `invoke` activity types. Node.js and Python do NOT have this behavior — parity gap worth tracking.
- **2026-04-13: PR #48 review — Python core/adapter split.** Reviewed @copilot's PR to extract `botas-fastapi` from `botas` core. Architecture is correct and mirrors Node.js `botas`/`botas-express` split. Requested changes: rebase needed (conflicts with merged PR #49), `build-all.sh` must include new package, need test for `bot_auth_dependency`. Noted that Python is now _ahead_ of Node.js in clean separation — Node.js core still has `botAuthExpress`/`botAuthHono` inline in `bot-auth-middleware.ts`. Follow-up needed to align Node.js.
- **Node.js parity gap: framework middleware in core.** `node/packages/botas/src/bot-auth-middleware.ts` exports `botAuthExpress()` (line 98) and `botAuthHono()` (line 135) directly from core. These use duck-typed signatures to avoid hard deps, but architecturally they belong in adapter packages like `botas-express` and a future `botas-hono`.
- **2026-04-13: PR #48 review completed & fix approved.** Reviewed architecture of Python core/fastapi split — architecture correct, approved. Hermes completed all 3 blocking changes: rebased, updated build-all.sh, added bot_auth_dependency test. PR unblocked for merge.
