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

### Team Updates (2026-05-21)

**TurnState Spec Ready (Issue #361 Phase 1)**:
- Leela drafted `specs/turn-state.md` with three-scope state model, storage abstraction, and lifecycle design
- **Your next task**: Implement TurnState + MemoryStorage for Python (Phase 2, pending Rido approval)
- Decision A6 captures open questions for architecture sign-off in `.squad/decisions.md`

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
- OTel spans use `get_tracer()` from `tracer_provider.py` with if/else pattern: span-wrapped path when tracer exists, direct call otherwise. Extract `_do_*` helper methods to avoid duplicating business logic.
- Inbound auth span attributes (`auth.issuer`, `auth.audience`, `auth.key_id`) must be set from peeked claims before full validation, since validation may raise before claims are accessible.
- `_validate_token` was extracted as a separate async function to keep `validate_bot_token` clean and allow span to wrap the full validation lifecycle.
- OTel tracer provider uses lazy init with try/except ImportError — `get_tracer()` returns None when opentelemetry-api is absent, so the library never crashes without telemetry deps
- opentelemetry-api is an optional dep under `[observability]` extras; also included in `[dev]` for test coverage

### TurnState Implementation (Issue #361 Phase 2) (2026-05-21)
- **Implemented TurnState per specs/turn-state.md**: Three-scope state model (conversation, user, temp) with automatic key derivation from activity fields.
- **Storage abstraction**: Added `Storage` protocol (ABC) under `python/packages/botas/src/botas/state/` with `MemoryStorage` (asyncio Lock-protected in-process dict) and `FileStorage` (JSON files on disk, asyncio.to_thread for I/O, urllib.parse.quote for key sanitization with safe="").
- **Middleware integration**: Added `BotApplication.use_state(storage)` method that registers state middleware. Loads state at turn start, saves dirty state ONLY if next() returns without raising (atomic semantics per spec). Temp scope never persisted.
- **TurnContext state property**: Added `state: Optional[TurnState]` to TurnContext __slots__. None when state middleware not registered.
- **Key derivation**: Matches .NET and Node format: `{channelId}/{botId}/conversations/{conversationId}` for conversation scope, `{channelId}/{botId}/users/{userId}` for user scope. Uses `activity.from_account` (not `from_` — that's a Python keyword remapped to `from_account` in CoreActivity).
- **Dirty tracking**: StateScope tracks JSON snapshot at load time, compares current state to snapshot to detect changes. Only writes dirty scopes.
- **Path syntax**: Supports `"scope.property"` (e.g., `"conversation.count"`) or bare `"property"` (defaults to temp scope). Validated: no more than one dot, scope must be conversation/user/temp.
- **Tests**: 46 new tests covering MemoryStorage, FileStorage, StateScope, TurnState, and middleware integration (round-trip, idempotent delete, atomic-on-error, dirty tracking, scope isolation). All 187 Python tests pass.
- **Ruff clean**: Linted with target-version = "py38", line-length 120, rules E/F/W/I.
- **FileStorage key encoding**: Uses urllib.parse.quote(key, safe="") for cross-platform filesystem safety. No locking (single-instance only per spec).

### 06-state-bot Sample (2026-05-21)
- **Created python/samples/06-state-bot/**: Runnable sample demonstrating TurnState with FileStorage backend persisting to `./state-data/` directory.
- **Bot behavior**: Increments "turn_count" in conversation scope and "user_message_count" in user scope on each message. Uses temp scope for formatted reply. Special commands: "reset" clears conversation state, "whoami" reads user state.
- **Parity with .NET and Node**: Same bot logic, same field names, same special commands, same state-data directory name, same percent-encoded filename pattern.
- **Files**: pyproject.toml (depends on botas-fastapi), main.py (registers state middleware via `app.bot.use_state(storage)`), README.md (setup, curl examples, state file inspection).
- **BotApp wrapper note**: `BotApp` (botas-fastapi wrapper) doesn't expose `use_state()` directly — access via `app.bot.use_state(storage)` to reach underlying `BotApplication`.
- **Build + lint**: `pip install -e .` succeeded, ruff check + format clean.
- **.gitignore updated**: Added `**/state-data/` and `**/bot-state/` patterns to exclude FileStorage directories from git.
- **README focus**: Demonstrates state persistence via JSON file inspection (no outbound activity sending to avoid Bot Service endpoint dependency). Users can inspect percent-encoded filenames in `./state-data/` to verify state changes across turns and restarts.
