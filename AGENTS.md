# AGENTS.md

## Overview

`botas` is a multi-language Bot Framework library. Implementations exist for:

- **.NET (C#)** — `dotnet/`
- **TypeScript / Node.js** — `node/`
- **Python** — `python/`

The goal is behavioral parity across all languages while following each language's idioms.

---

## Repository Layout

```text
botas/
├── dotnet/
│   └── Botas/
│       ├── BotApplication.cs
│       ├── ConversationClient.cs
│       ├── UserTokenClient.cs
│       ├── Schema/
│       │   ├── Activity.cs
│       │   ├── ChannelData.cs
│       │   ├── Conversation.cs
│       │   └── ConversationAccount.cs
│       └── Hosting/            # ASP.NET Core integration
├── node/
│   ├── package.json                # Workspace root (private)
│   ├── botas/                      # Published library
│   │   ├── src/
│   │   │   ├── app/            # BotApplication, BotHandlerException
│   │   │   ├── auth/           # JWT middleware, TokenManager
│   │   │   ├── clients/        # ConversationClient, UserTokenClient
│   │   │   ├── middleware/     # ITurnMiddleware interface
│   │   │   └── schema/         # Activity types, createReplyActivity
│   │   └── tsconfig.json
│   └── samples/
│       ├── express/                # Express integration sample
│       └── hono/                   # Hono integration sample
├── python/
│   ├── botas/                      # Published library
│   │   ├── pyproject.toml
│   │   ├── src/botas/          # Python library implementation
│   │   └── tests/
│   └── samples/
│       ├── aiohttp/                # aiohttp integration sample
│       └── fastapi/                # FastAPI integration sample
├── docs/bot-spec.md                # Canonical feature spec (read before porting)
└── AGENTS.md                       # This file
```

---

## Build & Test

### dotnet

```bash
cd dotnet
dotnet build Botas
dotnet test                 # if tests exist
```

### node

```bash
cd node
npm install
npm run build               # builds all workspaces

# Run a sample (requires tunneling, e.g. ngrok)
npx tsx samples/express/index.ts
npx tsx samples/hono/index.ts
```

### python

```bash
cd python/packages/botas
pip install -e ".[dev]"
python -m pytest tests/ -v

# Run a sample
python ../../samples/fastapi/main.py
python ../../samples/aiohttp/main.py
```

---

## Core Architecture

### Turn Pipeline

Every incoming activity flows through a pipeline:

```
HTTP POST /api/messages
  └─ Auth middleware (JWT validation)
       └─ BotApplication.processBody / ProcessAsync
            └─ middleware[0].onTurnAsync → next()
                 └─ middleware[1].onTurnAsync → next()
                      └─ ...
                           └─ handleActivityAsync (dispatches to registered handler)
```

Middleware can inspect/modify the activity or short-circuit by not calling `next()`.

### Two-Auth Model

- **Inbound**: Validate the JWT `Authorization` header on every POST using JWKS from `https://login.botframework.com/v1/.well-known/openid-configuration`
- **Outbound**: Acquire an OAuth2 client-credentials token (scope `https://api.botframework.com/.default`) before every activity send via the Bot Framework REST API

### Handler Dispatch

Handlers are registered by activity type string. When an activity arrives, the matching handler is called. Unregistered types are silently ignored.

- dotnet: single `OnActivity: Func<Activity, CancellationToken, Task>?` callback; dispatch logic lives in the application code
- node: `on(type, handler)` Map; the library dispatches by type

### Error Wrapping

Any exception thrown inside a handler is wrapped in `BotHandlerException` (node) / `BotHanlderException` (dotnet, note the typo — kept for backward compat). The wrapper carries the original exception and the triggering activity.

---

## Porting Checklist

Follow this order when adding a new language:

### 1. Schema

Implement the minimal set of types (keep fields minimal — add only when a feature needs them):

- [ ] `Activity` — `type`, `id`, `serviceUrl`, `channelId`, `text`, `replyToId`, `from`, `recipient`, `conversation`, `channelData`, `entities`, extension data
- [ ] `ChannelAccount` — `id`, `name`, `aadObjectId`, `role`, extension data
- [ ] `ConversationAccount` — `id`, `name`, `aadObjectId`, `role`, extension data
- [ ] `ChannelData` — `clientActivityId`, extension data
- [ ] `createReplyActivity(activity, text)` — copies conversation/serviceUrl/channelId, swaps from/recipient, sets replyToId
- [ ] JSON: camelCase, ignore nulls on write, preserve unknown properties

### 2. Inbound HTTP

- [ ] Expose `POST /api/messages` endpoint
- [ ] Parse request body as Activity JSON
- [ ] Validate JWT bearer token (JWKS, issuer `api.botframework.com` or `sts.windows.net/{tid}`, audience = bot app ID)
- [ ] Return `{}` on success, `401` on auth failure, `500` on handler error

### 3. Turn Pipeline

- [ ] `ITurnMiddleware` interface with `onTurnAsync(app, activity, next)`
- [ ] `use(middleware)` registration in order
- [ ] `BotApplication` dispatches through middleware chain then to handler
- [ ] `BotHandlerException` (or language-equivalent) wrapping

### 4. Outbound

- [ ] `TokenManager` — OAuth2 client credentials (`CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID` env vars)
- [ ] `ConversationClient.sendActivityAsync` — POST to `{serviceUrl}v3/conversations/{id}/activities`
- [ ] `UserTokenClient` — OAuth user token operations (getToken, signOut, etc.)

### 5. Idiom Choices

- [ ] Decide on web framework integration (framework-agnostic adapter preferred)
- [ ] Decide on handler registration pattern (single callback vs. per-type map)
- [ ] Document any intentional differences in docs/bot-spec.md under "Language-Specific Intentional Differences"

---

## Behavioral Invariants

These must hold in every language implementation:

1. JWT validation MUST happen before activity processing — never trust an unauthenticated request
2. `createReplyActivity` MUST copy `serviceUrl`, `channelId`, `conversation`; swap `from`/`recipient`; set `replyToId`
3. If no handler is registered for an activity type, the activity is silently ignored (no error)
4. Handler exceptions MUST be wrapped in a `BotHandlerException`-equivalent
5. Outbound activities MUST be authenticated with a client-credentials bearer token
6. Middleware MUST execute in registration order

---

## Configuration

All credentials come from environment variables:

| Variable | Description |
|----------|-------------|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID |
| `PORT` | HTTP listen port (default: 3978) |

---

## References

- [docs/bot-spec.md](docs/bot-spec.md) — full feature specification
- [Bot Framework REST API](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference)
- [Bot Framework authentication](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-authentication)
