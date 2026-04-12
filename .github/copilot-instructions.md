# Copilot Instructions for `botas`

## Purpose
This repository implements a multi-language Bot Framework library with .NET, Node.js, and Python ports. The primary work is library behavior parity, middleware pipeline consistency, and authentication correctness.

## What to read first
- `AGENTS.md` — porting guide and behavioral invariants for all languages
- `bot-spec.md` — canonical feature specification
- `README.md` — quick-start examples for .NET, Node, and Python
- `docs/Architecture.md` — design overview and authentication flow
- `docs/Setup.md` — Azure registration and bot credentials setup

## Build & test commands
Use the appropriate language folder for implementation changes.

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

### Python
```bash
cd python/packages/botas
pip install -e ".[dev]"
python -m pytest tests/ -v
```

## Key conventions
- Maintain behavior parity across all ports.
- Preserve unknown JSON properties on activity serialization/deserialization.
- JWT validation must happen before activity processing.
- `POST /api/messages` should return `{}` on success.
- Unregistered activity types should be silently ignored.
- Handler exceptions are wrapped in a language-specific `BotHandlerException` equivalent.
- Middleware executes in registration order.
- Environment variables: `CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID`, `PORT`.

## Use links, not duplication
If you need implementation or architectural details, link to the existing docs instead of re-stating them.

## What not to do
- Do not add new instructions that conflict with `AGENTS.md` or `bot-spec.md`.
- Do not treat this repo as a single-language project.
- Do not invent new authentication flows or HTTP contracts outside the Bot Framework model.

## Good first tasks for agents
- Update implementation docs when behavior changes.
- Add or extend tests for middleware ordering, auth validation, or response handling.
- Keep changes language-specific by editing only the relevant subfolder unless behavior parity requires cross-language updates.

## Files to inspect for changes
- `dotnet/src/Botas/` and `dotnet/samples/EchoBot/`
- `node/packages/botas/src/`
- `python/packages/botas/src/botas/`
- `e2e/` for cross-language integration tests
- `.github/workflows/` for CI expectations
