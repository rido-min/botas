# Contributing

**Purpose**: Behavioral invariants, CI setup, and how to add a new language port.
**Status**: Draft

---

## Getting Started

1. Read the [specs/](./README.md) — they are the single source of truth for all behavior.
2. Read [AGENTS.md](../AGENTS.md) — the porting guide for working in this repo.
3. Pick a language folder and work in it. Only make cross-language changes when behavioral parity requires it.

---

## Behavioral Invariants

These rules apply to **every** language implementation. Violations should be treated as bugs.

| Invariant | Spec reference |
|-----------|---------------|
| JWT validation MUST happen before any activity processing | [Inbound Auth](./inbound-auth.md) |
| `POST /api/messages` returns `{}` on success | [Protocol — Response](./protocol.md#response) |
| Unregistered activity types are silently ignored (no error) | [Protocol — Handler Dispatch](./protocol.md#handler-dispatch) |
| Handler exceptions are wrapped in `BotHandlerException` (or language equivalent) | [Protocol — Error Wrapping](./protocol.md#error-wrapping) |
| Middleware executes in registration order | [Protocol — Middleware](./protocol.md#middleware) |
| Middleware can short-circuit by not calling `next()` | [Protocol — Middleware](./protocol.md#middleware) |
| CatchAll handler replaces per-type dispatch when set | [Protocol — CatchAll Handler](./protocol.md#catchall-handler) |
| Unknown JSON properties are preserved on round-trip (extension data) | [Activity Schema — Serialization Rules](./activity-schema.md#serialization-rules) |
| Outbound requests use OAuth2 client-credentials tokens | [Outbound Auth](./outbound-auth.md) |
| `CoreActivityBuilder.withConversationReference` swaps from/recipient and copies routing fields | [Activity Schema](./activity-schema.md) |

---

## Build & Test

### Per-language

```bash
# .NET
cd dotnet
dotnet build Botas.slnx
dotnet test Botas.slnx

# Node.js
cd node
npm install
npm run build
npm test --workspaces --if-present

# Python
cd python/packages/botas
pip install -e ".[dev]"
python -m pytest tests/ -v
```

### All languages

```bash
./build-all.sh
```

### Linting

- **Python**: `cd python && ruff check .`
- **Node.js**: No separate lint step (TypeScript compiler catches type errors during build)
- **.NET**: Compiler warnings during build

---

## CI

CI runs on every push and pull request to `main`. The workflow is defined in [`.github/workflows/CI.yml`](../.github/workflows/CI.yml).

| Job | Runner | Steps |
|-----|--------|-------|
| `dotnet` | `ubuntu-latest` | Restore → Build → Test |
| `node` | `ubuntu-latest` | Install → Set version → Build → Test |
| `python` | `ubuntu-latest` | Install → Lint (ruff) → Test (pytest) |

All three jobs must pass before a PR can merge.

### Runtime versions

| Language | Version |
|----------|---------|
| .NET | 10.0 (preview) |
| Node.js | 22 |
| Python | 3.11 |

---

## Versioning

The repo uses [Nerdbank.GitVersioning](https://github.com/dotnet/Nerdbank.GitVersioning) with the version defined in [`version.json`](../version.json) at the repo root. The current base version is `0.1`.

---

## Repository Layout

```
botas/
├── specs/                 Canonical specifications (start here)
├── dotnet/
│   ├── src/Botas/         .NET library source
│   ├── samples/           .NET sample bots
│   └── tests/             .NET unit tests
├── node/
│   ├── packages/botas-core/ TypeScript library source + tests
│   └── samples/           Node.js sample bots
├── python/
│   ├── packages/botas/    Python library source + tests
│   └── samples/           Python sample bots
├── e2e/                   End-to-end test infrastructure
├── docs-site/             Jekyll documentation website
├── art/                   Logo and icon assets
├── AGENTS.md              Porting guide
├── README.md              Quick start
├── build-all.sh           Build all languages
└── version.json           Nerdbank.GitVersioning config
```

---

## Adding a New Language Port

### 1. Create the directory structure

```
{language}/
├── src/           Library source code
├── samples/       At least an echo-bot sample
└── tests/         Unit tests
```

### 2. Implement the core components

In order of priority:

| Component | What it does | Spec |
|-----------|-------------|------|
| `CoreActivity` | Activity model with extension data preservation | [Activity Schema](./activity-schema.md) |
| `CoreActivityBuilder` | Fluent builder with `withConversationReference` | [Activity Schema](./activity-schema.md) |
| `TokenManager` | OAuth2 client-credentials token acquisition and caching | [Outbound Auth](./outbound-auth.md) |
| `ConversationClient` | HTTP client for the Bot Service REST API | [Protocol — Outbound](./protocol.md#outbound-sending-activities) |
| `BotApplication` | Middleware pipeline + handler dispatch | [Protocol](./protocol.md) |
| `TurnContext` | Scoped context for handlers and middleware | [Protocol — TurnContext](./protocol.md#turncontext) |
| Inbound JWT validation | Validate incoming bearer tokens | [Inbound Auth](./inbound-auth.md) |
| `BotApp` (optional) | Zero-boilerplate wrapper | Language-specific convenience |

### 3. Follow language idioms

Each language should feel natural to its users. Refer to the [Language-Specific Intentional Differences](./README.md#language-specific-intentional-differences) table for examples of acceptable divergences.

### 4. Pass the acceptance criteria

All [user stories](./README.md#user-scenarios--testing) must pass:

1. **Echo Bot** — receive message, respond with echo, validate JWT
2. **Proactive Messaging** — send message using stored conversation reference
3. **Middleware Pipeline** — registration order, `next()` continuation, pre/post processing
4. **Teams Features** — mentions, adaptive cards, suggested actions

### 5. Add CI

Add a job to `.github/workflows/CI.yml` that builds, lints, and tests the new port.

### 6. Update docs

- Add the new language to the tables in [AGENTS.md](../AGENTS.md) and [README.md](../README.md)
- Add a new row to the [Language-Specific Intentional Differences](./README.md#language-specific-intentional-differences) table
- Document any intentional divergences from the spec

---

## What Not to Do

- Do not duplicate spec content — link to `specs/` instead.
- Do not invent new authentication flows or HTTP contracts outside the Bot Service model.
- Do not treat this repo as a single-language project.
- Do not add new dependencies without justification.

---

## References

- [AGENTS.md](../AGENTS.md) — porting guide and repo conventions
- [specs/README.md](./README.md) — full feature specification
- [Architecture](./architecture.md) — design overview and component diagram
- [Infrastructure Setup](./setup.md) — bot registration
