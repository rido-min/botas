# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Core Context

### Key Files

- `python/packages/botas/src/botas/` — Core library (bot_application.py, bot_auth.py, middleware, turn_context.py)
- `python/packages/botas/src/botas/remove_mention_middleware.py` — Strip bot mentions from activity text
- `python/packages/botas-fastapi/` — FastAPI framework adapter (separate package, PR #48 merged)
- `python/samples/` — Sample bots (echo-bot, fastapi, aiohttp, teams-sample)
- `python/AUDIT.md` — Security audit findings (critical AsyncClient resource leak, P1 fixes merged)

### Patterns & Conventions

- **Middleware protocol:** `ITurnMiddleware` is a `Protocol` with `on_turn_async(context, next)`, registered via `bot.use()`
- **Entity extra fields:** Entity model uses `extra="allow"` — access mention fields via `entity.model_dump(by_alias=True)`
- **Bot identity:** `context.app.appid` (client ID) or `activity.recipient` (channel account) for mention matching
- **Typing activity:** `send_typing() -> None` (ephemeral, no ResourceResponse); decorator-capable `on_typing(handler)`
- **FluentCards:** Adaptive Cards use `fluent-cards` PyPI with `AdaptiveCardBuilder` + `to_json(card)` → JSON string
- **Linting:** ruff (E, F, W, I rules, 120-char line length) — always run before commit

### Resolved Issues

- **RemoveMentionMiddleware parity:** Implemented Python version; case-insensitive ID/text matching, removed name-based check
- **P1 security fixes:** Auth error sanitization, JWKS timeout (10s), body size limit (1MB), SSRF prevention, malformed JSON handling
- **P2/umbrella fixes:** Resource cleanup, type hints, Python version alignment (>=3.12), async context manager patterns
- **Typing activity:** Implemented `on_typing()` + `send_typing()` following approved API spec
- **FastAPI decoupling:** `botas-fastapi` now separate package; PR #48 merged with `bot_auth_dependency` test coverage
- **FluentCards adoption:** Refactored teams-sample (cross-language parity with .NET, Node.js)

### Current State

- **Test coverage:** 94 tests pass (48 core + 46 FastAPI); P1 security tests included
- **Build status:** Python 3.12+ required, ruff clean, all samples verified
- **Latest work:** FluentCards adoption complete, documentation reviews passed
- **Package status:** `botas` and `botas-fastapi` both on PyPI; `build-all.sh` installs both

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- Entity field access requires `model_dump(by_alias=True)` for proper alias expansion
- Pydantic v2 `extra="allow"` enables flexible schema handling without breaking validation
- Async context managers critical for resource cleanup in long-running servers
- Extra fields on CoreActivity (membersAdded, reactionsAdded, action) use original JSON camelCase keys via Pydantic extra="allow"; access with `getattr(activity, "membersAdded", None)` — they're raw dicts/lists, not typed models
- PR #221: Added conversationUpdate, messageReaction, typing, installationUpdate handlers to Python teams-sample (issue #218)

