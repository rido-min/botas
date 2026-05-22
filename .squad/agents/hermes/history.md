# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Core Context

### Key Files

- `python/packages/botas/src/botas/` — Core library (bot_application.py, bot_auth.py, middleware, turn_context.py)
- `python/packages/botas/src/botas/state/file_storage.py` — File-based state storage with Windows long-path handling
- `python/packages/botas/src/botas/remove_mention_middleware.py` — Strip bot mentions from activity text
- `python/packages/botas-fastapi/` — FastAPI framework adapter (separate package, PR #48 merged)
- `python/samples/` — Sample bots (echo-bot, fastapi, aiohttp, teams-sample, 06-state-bot)
- `python/AUDIT.md` — Security audit findings (critical AsyncClient resource leak, P1 fixes merged)

### Team Updates (2026-05-21)

**FileStorage Windows Long-Path Fix (2026-05-21)**:
- Fixed Windows MAX_PATH (260 char) issue in FileStorage that caused `FileNotFoundError` with long Teams conversation IDs
- Added automatic `\\?\` extended-length path prefix for paths > 240 chars on Windows
- Verified fix with real Teams conversation ID: `a:1t_vf556eJFtnbZeW8p6uf8FvivJrmstnQrNeFQVQhwbMAA09Ux_RdJaigXkt7oqASGR0IaAN7GjDL1lFM_p3Qbgfibz-7zApXCbxgqo85uMphAlnVyI6YaAs5HRNR7BW`
- No cross-language parity impact (implementation detail, not protocol change)

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
- **Windows long paths:** FileStorage auto-detects paths > 240 chars and applies `\\?\` prefix (no user action needed)

### Resolved Issues

- **FileStorage Windows long paths:** Fixed MAX_PATH issue for Teams conversation IDs (Issue #361 related)
- **RemoveMentionMiddleware parity:** Implemented Python version; case-insensitive ID/text matching, removed name-based check
- **P1 security fixes:** Auth error sanitization, JWKS timeout (10s), body size limit (1MB), SSRF prevention, malformed JSON handling
- **P2/umbrella fixes:** Resource cleanup, type hints, Python version alignment (>=3.12), async context manager patterns
- **Typing activity:** Implemented `on_typing()` + `send_typing()` following approved API spec
- **FastAPI decoupling:** `botas-fastapi` now separate package; PR #48 merged with `bot_auth_dependency` test coverage
- **FluentCards adoption:** Refactored teams-sample (cross-language parity with .NET, Node.js)

### Current State

- **Test coverage:** 205 tests pass (all green), including new `test_long_teams_conversation_key` for Windows path handling
- **Build status:** Python 3.12+ required, ruff clean, all samples verified
- **Latest work:** FileStorage long-path fix for Windows, verified with sample directory smoke test
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
- TurnState load → handler → save must be atomic per `(conversation_key, user_key)`; storage-level read/write locks still allow lost updates, so use a per-key async lock around the whole sequence and audit parity ports for the same pattern.

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

### FileStorage Windows Long-Path Fix (2026-05-21)
- **Bug**: FileStorage raised `FileNotFoundError` on Windows when absolute paths exceeded 260 chars (MAX_PATH limit). Triggered by real Teams conversation IDs like `a:1t_vf556eJFtnbZeW8p6uf8FvivJrmstnQrNeFQVQhwbMAA09Ux_RdJaigXkt7oqASGR0IaAN7GjDL1lFM_p3Qbgfibz-7zApXCbxgqo85uMphAlnVyI6YaAs5HRNR7BW` (193 chars raw, ~210 chars percent-encoded).
- **Root cause**: Python's pathlib doesn't automatically use extended-length path prefix (`\\?\`) on Windows. When combined with project base path (`D:\code\botas\python\samples\06-state-bot\state-data\`), total path exceeded 260 chars.
- **Fix**: Added automatic `\\?\` prefix in `_key_to_path()` for Windows when absolute path > 240 chars (240 chosen as safe threshold before MAX_PATH). Implementation: `if sys.platform == "win32" and len(abs_path_str) > 240: return Path(f"\\\\?\\{abs_path_str}")`.
- **Testing**: Added `test_long_teams_conversation_key` with real Teams conversation ID (193 chars), verified write/read/delete round-trip succeeds in sample directory context where path is 261 chars. Smoke test via `test_long_path.py` in sample directory confirmed fix works.
- **Cross-language impact**: None — this is a Python-specific implementation detail for Windows path handling. .NET and Node.js have different path length handling mechanisms. No spec change required.
- **Learning**: On Windows, Python pathlib needs explicit `\\?\` prefix for paths > 260 chars. `path.resolve()` alone doesn't add it. Always test with real-world long keys in deep directory structures to catch MAX_PATH issues early.

### 06-state-bot Sample Offline Mode Fix (2026-05-15)
- **Bug**: Python `06-state-bot` sample wasn't sending replies back to users. Handler built reply in temp state but never called `ctx.send()`.
- **Root cause**: Copy-paste error during sample creation — forgot to add the send call (lines present in .NET and Node versions).
- **User impact**: State files were created correctly, but no response reached Bot Service or was visible to user. Silent failure (HTTP 200 returned, no error logged).
- **Fix applied**: Added `await ctx.send(reply)` to regular message handler and special commands ("reset", "whoami").
- **Offline mode pattern**: Since sample runs locally without Bot Service credentials, added CLIENT_ID check:
  - If `CLIENT_ID` not set → `OFFLINE_MODE = True`, print warning at startup
  - In handlers: `if OFFLINE_MODE: print(f"[OFFLINE] Would send: {reply}") else: await ctx.send(reply)`
  - This lets users see state persistence + would-be replies without provisioning Azure bot
- **README updated**: Documented offline mode behavior, expected console output (`[OFFLINE] Would send: ...`), and optional CLIENT_ID/CLIENT_SECRET for real Bot Service communication.
- **Cross-language parity note**: Created `.squad/decisions/inbox/hermes-sample-offline-mode.md` for Amy (.NET) and Fry (Node.js) to verify their samples send replies and consider mirroring offline mode pattern if needed.
- **Files changed**: `python/samples/06-state-bot/main.py` (added offline mode check + send calls), `python/samples/06-state-bot/README.md` (documented offline behavior).
- **Tests**: All 216 Python tests still pass. Verified offline mode by running sample without CLIENT_ID and sending curl requests → console shows `[OFFLINE] Would send: Turn #1 | Your message #1: ...`, state files grow correctly.

### test-bot Counter Handler for Playwright E2E (2026-05-21)
- **Task**: Extended `python/samples/test-bot/main.py` to support TurnState counter contract for Playwright Teams tests (parallel work with Amy and Fry doing .NET and Node.js implementations).
- **Contract**: On `"counter"` command → increment count in user scope (starts at 0), reply `Count: N`. On `"reset"` → clear user scope count, reply `Counter reset`.
- **Implementation**: Added `app.use_state(MemoryStorage())` middleware registration. Added counter and reset handlers BEFORE catch-all echo so they take precedence (case-insensitive text matching with `.strip()`).
- **State API pattern**: `ctx.state.user.get("count", int) or 0` to get count (defaults to 0 if None), `ctx.state.user.set("count", count)` to set, `ctx.state.user.delete("count")` to clear.
- **Reply format**: Exact text `Count: N` (capital C, single space) for Playwright regex matching.
- **Testing**: Ruff check + format clean, all 205 pytest tests pass (11 skipped). MemoryStorage choice sidesteps FileStorage long-path issue and avoids persistence requirements for Playwright ephemeral tests.
- **No library changes**: Sample-only modification. All other test-bot commands (card, submit, mention, echo, invoke) preserved as-is.

### 2026-05-21 — Playwright E2E Bot Startup Timeout Failure (Issue #361, E2E Phase)

**Context**: Nibbler executed Playwright e2e tests on feat/361-turn-state branch. All 5 Python e2e tests failed with timeout on `/health` endpoint during bot initialization.

**Finding**: 
- Test framework calls `/health` to verify bot readiness
- Timeout occurs during initial startup, before any test-bot counter logic executes
- Pattern: Bot fails to respond to health check within e2e test harness timeout window
- Not TurnState-specific (counter handlers never run due to startup failure)

**Likely causes to investigate**:
1. AsyncClient or aiohttp initialization delays in e2e environment
2. Auth token acquisition timeout during startup with test credentials  
3. FastAPI app registration or middleware setup delays
4. Async event loop or context manager timing issues

**Impact**: All Playwright e2e tests blocked for Python until startup issue resolved.

**Cross-language pattern**: Amy (.NET) reports identical startup timeout failure. Suggests infrastructure or e2e test harness issue, not language-specific.

**Next step**: Debug bot startup in e2e test harness with async logging enabled. Check if issue reproduces locally with same test harness.

### 2026-05-21 — PR #362 Review Comment Fixes (Issue #361 TurnState Branch)

**Context**: Addressed three Python-specific PR review comments from Copilot reviewer on feat/361-turn-state branch (PR #362).

**Comment 1 — BotApp.use_state() Delegator**:
- **Issue**: `python/samples/test-bot/main.py` called `app.use_state(MemoryStorage())` but `BotApp` (botas-fastapi wrapper) didn't expose `use_state()` method. Would raise `AttributeError` at runtime.
- **Fix**: Added `use_state(self, storage: Storage) -> "BotApp"` method to `BotApp` class in `python/packages/botas-fastapi/src/botas_fastapi/bot_app.py` that delegates to `self.bot.use_state(storage)` and returns `self` (fluent builder pattern).
- **Parity rationale**: Node.js `botas-express` already has `useState(storage)` delegator (line 94 of bot-app.ts). Python must match for cross-language API consistency. Both `app.use_state()` and `app.bot.use_state()` now work.
- **Verification**: `python -c "from botas_fastapi import BotApp; print(callable(BotApp().use_state))"` → `True`.

**Comment 2 — bot-pid.txt Artifact**:
- **Issue**: `python/samples/06-state-bot/bot-pid.txt` committed to repo (looks like local PID file from test run).
- **Fix**: `git rm python/samples/06-state-bot/bot-pid.txt` + created `.gitignore` with `bot-pid.txt` pattern (matching Node sample .gitignore pattern: `state-data/` + artifact file).
- **Finding**: No Python code writes this file (checked main.py, e2e scripts). Likely accidental commit during local testing. .gitignore prevents future occurrences.

**Comment 3 — MemoryStorage Reference Leakage**:
- **Issue**: `MemoryStorage.read()` returned same object references stored in `_store`. If turn loads existing state and mutates nested data in-place, mutations leak into underlying store even when turn fails (breaking atomic-on-error semantics) and bypass dirty tracking.
- **Fix**: Added `import copy` and deep-cloned values on BOTH read AND write:
  - `read()`: `{k: copy.deepcopy(self._store[k]) for k in keys if k in self._store}`
  - `write()`: `self._store.update({k: copy.deepcopy(v) for k, v in changes.items()})`
- **Why both directions**: Read isolation prevents in-place mutations from affecting store; write isolation prevents caller from mutating stored values after write call completes.
- **Behavioral parity**: .NET and Node.js MemoryStorage implementations already deep-clone (via serialization or object spread). Python now matches isolation semantics.
- **Testing**: All 205 tests pass. State middleware tests (`test_turn_state_middleware_*`) verify atomic-on-error correctly with new deep-clone behavior. No test asserted old reference-sharing behavior (tests were spec-compliant).

**Tools**: pytest (all pass), ruff check + format (clean), git rm for artifact removal.

**Decision**: Created `.squad/decisions/inbox/hermes-pr362-usestate-delegator.md` documenting BotApp parity contract (useState/use_state must exist on host framework wrappers for API consistency).

