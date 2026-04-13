# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

- **Middleware protocol**: `ITurnMiddleware` is a `Protocol` with `on_turn_async(context, next)`. Middleware is registered via `bot.use()` and runs in registration order.
- **Entity extra fields**: `Entity` model uses `extra="allow"` (from `_CamelModel`), so mention-specific fields like `mentioned` and `text` live in `model_extra` — access them via `entity.model_dump(by_alias=True)`.
- **Bot identity**: `context.app.appid` gives the bot's client ID; `activity.recipient` gives the bot's channel account. Both can be used to match mention entities.
- **Key files**: `remove_mention_middleware.py` (middleware), `tests/test_remove_mention_middleware.py` (8 tests), `samples/echo-bot-no-mention/` (sample).
- **Build/test verified**: `pip install -e ".[dev]" && python -m pytest tests/ -v` — 45 tests pass. Lint: `ruff check src/ tests/`.

### Cross-language parity (2026-04-13)
- **Amy (.NET):** Created `RemoveMentionMiddleware` class and added `BotApp.Use()` method. Uses deferred registration pattern for middleware before handlers. MentionBot sample. 10 tests passing (27 total).
- **Fry (Node.js):** Created `remove-mention-middleware.ts` implementing `ITurnMiddleware`, mutates `activity.text` in-place, matches `recipient.id`. 10 tests passing (36 total).
- All three implementations maintain behavior parity: strip self-mentions, case-insensitive, include samples/docs.
- `botas-fastapi` is a separate package at `python/packages/botas-fastapi/` — decoupled from core `botas` (PR #48)
- `build-all.sh` now installs both `botas` and `botas-fastapi` in the Python section
- FastAPI's `bot_auth_dependency` lives in `botas_fastapi` package, not in core `botas`
- Docs (README, getting-started, python.md) use `BotApp` for quick-start examples (aiohttp-based, no FastAPI dep)
- **2026-04-13: PR #48 blocking fixes completed.** Rebased onto main (3 doc conflicts resolved), added botas-fastapi to build-all.sh, added bot_auth_dependency test coverage. Force-pushed for unblocked review.
- **on_activity CatchAll handler implemented.** Added `on_activity` property to `BotApplication` that replaces per-type dispatch when set. Uses `self.on_activity or self._handlers.get(...)` pattern — clean single-line fallback. 4 new tests in `TestOnActivityCatchAll`. All 35 tests pass, ruff clean.
