# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### RemoveMentionMiddleware (Issue #51)
- `ITurnMiddleWare` (capital W) is the middleware interface; `NextDelegate` is the next callback type.
- `CoreActivity.Entities` is a `JsonArray` — mention entities have `type: "mention"`, `mentioned: {id, name}`, and `text` fields.
- `BotApp` defers both handler (`On`) and middleware (`Use`) registration until `Run()` since `BotApplication` isn't available until after `Build()`.
- Added `BotApp.Use(ITurnMiddleWare)` to mirror the deferred-registration pattern already used by `BotApp.On()`.
- Key files: `RemoveMentionMiddleware.cs` in `dotnet/src/Botas/`, tests in `dotnet/tests/Botas.Tests/RemoveMentionMiddlewareTests.cs`, sample in `dotnet/samples/MentionBot/`.
- `TurnContext` constructor is `internal` — tests can access it via `InternalsVisibleTo("Botas.Tests")`.

### Cross-language parity (2026-04-13)
- **Fry (Node.js):** Created `node/packages/botas/src/remove-mention-middleware.ts` implementing `ITurnMiddleware`, matches `recipient.id`, mutates `activity.text` in-place. 10 tests passing (36 total).
- **Hermes (Python):** Created `python/packages/botas/src/botas/remove_mention_middleware.py` using Protocol-based middleware, matches bot AppId, strips `<at>` mentions. 8 tests passing (45 total).
- All three implementations have behavior parity: strip bot-self mentions, case-insensitive matching, provide samples.
- **2026-04-13: OnActivity CatchAll verification (2026-04-13).** Verified existing .NET `BotApplication.OnActivity` property already implements correct CatchAll semantics per spec: when set, bypasses all per-type handlers entirely; exceptions wrapped in `BotHandlerException`; unregistered types still silently ignored. No code changes needed. .NET serves as canonical reference implementation. Noted: existing test coverage is minimal; recommend follow-up.
