# AGENTS.md

## Overview

`botas` is a multi-language Bot Framework library with implementations in **.NET**, **Node.js**, and **Python**. The goal is behavioral parity across all languages while following each language's idioms.

---

## How to Work in This Repo

### 1. Read the specs first

All behavior, schemas, and protocol details live in [`specs/`](specs/README.md). That is the single source of truth. Start there before making any implementation changes.

| Spec | What it covers |
|------|----------------|
| [Protocol](specs/protocol.md) | HTTP contract, middleware pipeline, handler dispatch, error wrapping |
| [Activity Schema](specs/activity-schema.md) | JSON payload structure, serialization rules |
| [Inbound Auth](specs/inbound-auth.md) | JWT validation for incoming requests |
| [Outbound Auth](specs/outbound-auth.md) | OAuth 2.0 client credentials for outbound requests |
| [README](specs/README.md) | User stories, API surface, language-specific differences |

### 2. Pick a language and implement

Each language lives in its own directory. Work in the relevant subfolder unless a change requires cross-language updates for behavioral parity.

| Language | Library code | Samples | Tests |
|----------|-------------|---------|-------|
| .NET | `dotnet/src/Botas/` | `dotnet/samples/EchoBot/` | `dotnet/tests/` |
| Node.js | `node/packages/botas/src/` | `node/samples/` | `node/packages/botas/src/*.spec.ts` |
| Python | `python/packages/botas/src/botas/` | `python/samples/` | `python/packages/botas/tests/` |

### 3. Keep implementations in sync

When a spec change affects behavior, update all three languages. When adding an idiomatic feature to one language, document intentional differences in [`specs/README.md`](specs/README.md) under "Language-Specific Intentional Differences".

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

### Python Linting (required before committing)

Python uses **ruff** for linting and formatting. Always run before committing Python changes:

```bash
cd python/packages/botas
python -m ruff check --fix src/ tests/
python -m ruff format src/ tests/
```

Rules: `E`, `F`, `W`, `I` — line length **120** (see `python/packages/botas/pyproject.toml`).

### All languages

```bash
./build-all.sh
```

---

## What Not to Do

- Do not duplicate spec content in this file or elsewhere — link to `specs/` instead.
- Do not invent new authentication flows or HTTP contracts outside the Bot Framework model.
- Do not treat this repo as a single-language project.

---

## Docs & Samples Sync

When updating samples or library API signatures, **always update the corresponding docs and specs in the same change**:

- `docs-site/` — user-facing documentation (code examples must match current samples)
- `specs/future/` — API surface specs (signatures must match current implementations)
- `specs/README.md` — overview examples (must reflect current API)

Verify with a quick grep: `grep -rn 'oldPattern' docs-site/ specs/` before committing.

---

## References

- [specs/](specs/README.md) — canonical feature specification (start here)
- [specs/Architecture.md](specs/Architecture.md) — design overview and component diagram
- [specs/Setup.md](specs/Setup.md) — Azure registration and bot credentials
- [Bot Framework REST API](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference)
- [Bot Framework authentication](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-authentication)
