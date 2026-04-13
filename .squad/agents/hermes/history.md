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

### Security & Best Practices Audit (2026-04-13)

**Comprehensive audit completed across all Python code.** Key findings documented in `python/AUDIT.md`.

**CRITICAL finding:** `httpx.AsyncClient` resource leak in `BotHttpClient`. Client created in `__init__` but never closed. This causes TCP connection pool exhaustion and memory leaks in long-running servers. Fix requires:
1. Add `async def aclose()` to `BotApplication` that calls `self.conversation_client._http.aclose()`
2. Add FastAPI lifespan hook in `BotApp._build_app()` to close on shutdown
3. Implement `__aenter__` / `__aexit__` for async context manager protocol

**Security strengths:**
- JWT validation is robust — JWKS refresh, audience check, issuer whitelist, thread-safe caching
- No injection vectors — Pydantic validation prevents malformed JSON, no eval/exec/pickle
- Secrets handled correctly — all samples use env vars, no hardcoded values
- Deserialization safe — no pickle, json.loads wrapped in Pydantic validation

**Other notable issues:**
- Large payload handling — no size limits on incoming activity JSON (10MB limit recommended)
- Python version mismatch — botas requires >=3.12, botas-fastapi claims >=3.11 (install will fail)
- Type hints incomplete on dict-based APIs — `ctx.send(dict)` needs documented required keys
- Missing async cleanup hooks cause resource leaks on shutdown

**Best practices followed:**
- Clean package structure with proper `__all__` exports
- Pydantic v2 usage is excellent — `_CamelModel` base, `extra="allow"`, proper alias handling
- Exception handling correct — `BotHandlerException` wraps with cause preservation
- Async/await usage correct — all calls awaited, no fire-and-forget tasks
- No circular references or GC issues

**Test coverage good:** 48 tests across bot_application, core_activity, remove_mention_middleware, teams_activity, and botas-fastapi. All passing, ruff lint clean.

**Recommendations prioritized:** P0 (immediate) = resource leak fix. P1 (next release) = async context manager + body size limit. P2 (nice to have) = improved type hints, docstrings, expanded lint rules.

### Session Summary (2026-04-13)
- **Audit Result:** Python audit completed and logged to `python/AUDIT.md` and `.squad/orchestration-log/2026-04-13T0805-hermes-audit.md`.
- **Artifacts:** Orchestration log captures critical AsyncClient resource leak finding with detailed remediation steps.
- **Cross-Agent:** .NET and Node.js audits completed. Coordinating across three implementations for shared security concerns. See decisions.md for full context.
