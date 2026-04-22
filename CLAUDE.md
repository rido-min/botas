# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

`botas` is a multi-language Bot Framework library with implementations in **.NET**, **Node.js**, and **Python**. The primary work is behavioral parity across languages, middleware pipeline consistency, and authentication correctness.

Read these first:
- `specs/README.md` — canonical feature specification and language-specific intentional differences
- `specs/architecture.md` — design overview and component diagram
- `AGENTS.md` — porting guide and behavioral invariants

## Build & Test

### .NET
```bash
cd dotnet
dotnet restore Botas.slnx
dotnet build Botas.slnx
dotnet test Botas.slnx
```

### Node.js
```bash
cd node
npm install
npm run build
npm test
```
Run a single test file: `npx jest packages/botas/src/bot-application.spec.ts`

### Python
```bash
cd python/packages/botas
pip install -e ".[dev]"
python -m pytest tests/ -v
```
Run a single test: `python -m pytest tests/test_bot_application.py -v`

### Python linting (required before committing)
```bash
cd python/packages/botas
python -m ruff check --fix src/ tests/
python -m ruff format src/ tests/
```
Rules: `E`, `F`, `W`, `I` — line length **120**.

### All languages
```bash
./build-all.sh
```

## Source Locations

| Language | Library | Tests |
|----------|---------|-------|
| .NET | `dotnet/src/Botas/` | `dotnet/tests/` |
| Node.js | `node/packages/botas/src/` | `node/packages/botas/src/*.spec.ts` |
| Python | `python/packages/botas/src/botas/` | `python/packages/botas/tests/` |

Framework adapters: `node/packages/botas-express/`, `python/packages/botas-fastapi/`

## Architecture

Every incoming activity goes through this pipeline:

```
POST /api/messages
  └─ JWT validation (inbound auth) → 401 on failure
      └─ BotApplication
          ├─ Middleware (in registration order)
          └─ Handler dispatch (by activity.type)
              └─ ConversationClient sends outbound activities (OAuth2 client credentials)
```

**Two-auth model**:
- **Inbound**: JWT bearer token validated before any processing. Fetches JWKS from botframework.com.
- **Outbound**: `TokenManager` acquires and caches OAuth2 client-credentials tokens for Bot Framework API calls.

**Handler registration** (per language):
- Node.js / Python: `on(type, handler)` / `@bot.on("type")` decorator — one handler per activity type
- .NET: Single `OnActivity` callback; dispatch logic in the handler

**Middleware**: Recursive callback pipeline. Each middleware receives `(context, next)`. Not calling `next()` short-circuits. Runs before handler dispatch.

**CoreActivity**: Typed fields (`type`, `text`, `from`, `recipient`, etc.) plus an extension dictionary that preserves unknown JSON properties.

## Key Behavioral Invariants

- JWT validation happens before activity processing.
- `POST /api/messages` returns `{}` on success.
- Unregistered activity types are silently ignored (no error).
- Handler exceptions are wrapped in a language-specific `BotHandlerException`.
- Middleware executes in registration order.
- Unknown JSON properties on activities must round-trip safely.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID (default: `common`) |
| `PORT` | HTTP listen port (default: `3978`) |

## Cross-Language Changes

When a spec change affects behavior, update all three language implementations. Intentional language-specific differences belong in `specs/README.md` under "Language-Specific Intentional Differences".

When updating samples or library API signatures, always update the corresponding docs (`docs-site/`) and specs (`specs/`) in the same change. Verify with grep before committing.

Do not duplicate spec content — link to `specs/` instead.
