# AGENTS.md

## Overview

`botas` is a multi-language Bot Framework library with implementations in **.NET**, **Node.js**, and **Python**. The goal is behavioral parity across all languages while following each language's idioms.

---

## How to Work in This Repo

### 1. Read the specs first

All behavior, schemas, and protocol details live in [`docs/specs/`](docs/specs/README.md). That is the single source of truth. Start there before making any implementation changes.

| Spec | What it covers |
|------|----------------|
| [Protocol](docs/specs/protocol.md) | HTTP contract, middleware pipeline, handler dispatch, error wrapping |
| [Activity Schema](docs/specs/activity-schema.md) | JSON payload structure, serialization rules |
| [Inbound Auth](docs/specs/inbound-auth.md) | JWT validation for incoming requests |
| [Outbound Auth](docs/specs/outbound-auth.md) | OAuth 2.0 client credentials for outbound requests |
| [README](docs/specs/README.md) | User stories, API surface, language-specific differences |

### 2. Pick a language and implement

Each language lives in its own directory. Work in the relevant subfolder unless a change requires cross-language updates for behavioral parity.

| Language | Library code | Samples | Tests |
|----------|-------------|---------|-------|
| .NET | `dotnet/src/Botas/` | `dotnet/samples/EchoBot/` | `dotnet/tests/` |
| Node.js | `node/packages/botas/src/` | `node/samples/` | `node/packages/botas/src/*.spec.ts` |
| Python | `python/packages/botas/src/botas/` | `python/samples/` | `python/packages/botas/tests/` |

### 3. Keep implementations in sync

When a spec change affects behavior, update all three languages. When adding an idiomatic feature to one language, document intentional differences in [`docs/specs/README.md`](docs/specs/README.md) under "Language-Specific Intentional Differences".

---

## Build & Test

### .NET

```bash
cd dotnet
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

### All languages

```bash
./build-all.sh
```

---

## What Not to Do

- Do not duplicate spec content in this file or elsewhere — link to `docs/specs/` instead.
- Do not invent new authentication flows or HTTP contracts outside the Bot Framework model.
- Do not treat this repo as a single-language project.

---

## References

- [docs/specs/](docs/specs/README.md) — canonical feature specification (start here)
- [docs/Architecture.md](docs/Architecture.md) — design overview and component diagram
- [docs/Setup.md](docs/Setup.md) — Azure registration and bot credentials
- [Bot Framework REST API](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference)
- [Bot Framework authentication](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-authentication)
