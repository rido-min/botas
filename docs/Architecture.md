# Architecture

BotAS is a thin adapter between an HTTP framework and the [Microsoft Bot Framework REST API](https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference). The same design is implemented in .NET, Node.js, and Python.

---

## Turn pipeline

Every incoming bot activity travels through this pipeline:

```
HTTP POST /api/messages
  │
  ├─ Auth middleware          validate JWT bearer token (inbound auth)
  │
  └─ BotApplication
       ├─ middleware[0].onTurnAsync(app, activity, next)
       ├─ middleware[1].onTurnAsync(app, activity, next)
       ├─ ...
       └─ handler dispatch    call handler registered for activity.type
                              (silently ignore if no handler registered)
```

Middleware executes in registration order. Each middleware calls `next()` to continue; omitting the call short-circuits the pipeline.

---

## Two-auth model

### Inbound — JWT validation

Every POST to `/api/messages` must carry a signed JWT in the `Authorization: Bearer <token>` header. The library:

1. Fetches the signing keys from `https://login.botframework.com/v1/.well-known/openid-configuration`
2. Validates the token signature, issuer (`api.botframework.com` or `sts.windows.net/{tenantId}`), and audience (your `CLIENT_ID`)
3. Returns `401` if validation fails — the activity never reaches middleware or handlers

### Outbound — client credentials

When the bot sends an activity back to the channel, it calls the Bot Framework REST API. Before each outbound call the library:

1. Acquires an OAuth2 token using client credentials (`CLIENT_ID`, `CLIENT_SECRET`, `TENANT_ID`)
2. Scope: `https://api.botframework.com/.default`
3. Attaches the token as `Authorization: Bearer <token>` on the outbound request

Token acquisition is handled by a `TokenManager` component; tokens are cached and refreshed automatically.

---

## Components

```
┌─────────────────────────────────────────────────────┐
│                   Web Framework                      │
│          (ASP.NET Core / Express / FastAPI)          │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP POST /api/messages
                       ▼
┌─────────────────────────────────────────────────────┐
│              Auth Middleware                         │
│  BotAuthenticationHandler  /  botAuthExpress()       │
│  /  bot_auth_dependency()                            │
│                                                     │
│  ● Fetches JWKS from botframework.com               │
│  ● Validates JWT signature, issuer, audience        │
│  ● Returns 401 on failure                           │
└──────────────────────┬──────────────────────────────┘
                       │ validated Activity JSON
                       ▼
┌─────────────────────────────────────────────────────┐
│                 BotApplication                       │
│                                                     │
│  use(middleware)   register middleware               │
│  on(type, fn)      register handler (Node/Python)   │
│  OnActivity        single callback (.NET)            │
│                                                     │
│  processAsync / ProcessAsync / process_body          │
│    → run middleware chain                           │
│    → dispatch to handler by activity.type           │
│    → wrap handler exceptions in BotHandlerException │
└──────┬──────────────────────────────────────────────┘
       │ bot wants to reply
       ▼
┌─────────────────────────────────────────────────────┐
│             ConversationClient                       │
│                                                     │
│  sendActivityAsync(serviceUrl, conversationId, act) │
│    → TokenManager acquires/caches outbound token    │
│    → POST {serviceUrl}v3/conversations/{id}/        │
│           activities                                │
└─────────────────────────────────────────────────────┘
```

### Supporting components

| Component | Purpose |
|---|---|
| `TokenManager` | OAuth2 client-credentials token acquisition and caching |
| `UserTokenClient` | OAuth user token operations (getToken, signOut, exchange) |
| `createReplyActivity` | Helper — copies routing fields, swaps from/recipient, sets replyToId |

---

## Activity schema

The core `Activity` type carries all information about a single turn:

```json
{
  "type": "message",
  "id": "activity-id",
  "serviceUrl": "https://smba.trafficmanager.net/amer/",
  "channelId": "msteams",
  "text": "Hello!",
  "replyToId": "previous-activity-id",
  "from": {
    "id": "user-aad-object-id",
    "name": "Alice",
    "aadObjectId": "user-aad-object-id",
    "role": "user"
  },
  "recipient": {
    "id": "bot-app-id",
    "name": "My Bot",
    "role": "bot"
  },
  "conversation": {
    "id": "conversation-id",
    "name": null,
    "isGroup": false
  },
  "channelData": { },
  "entities": []
}
```

**Key rules:**

- Unknown properties are preserved in an extension dictionary so custom channel data round-trips safely
- `null` values are omitted on serialization
- All property names use camelCase in JSON

### Activity types

| `type` value | When it fires |
|---|---|
| `message` | User or bot sends a text message |
| `conversationUpdate` | Members added or removed from the conversation |
| `messageReaction` | Emoji reaction added or removed from a message |
| `installationUpdate` | Bot installed or uninstalled |
| `invoke` | Synchronous request requiring an immediate response body |

---

## Handler dispatch

### Node.js / Python — per-type map

```
activity arrives with type = "message"
  → look up handler registered with on("message", fn)
  → call fn(activity)
  → unregistered types are silently ignored
```

### .NET — single callback

```
activity arrives
  → OnActivity(activity, cancellationToken) is called
  → dispatch logic lives in application code (switch on activity.Type)
```

---

## Error handling

Any exception thrown inside a handler is caught and re-thrown wrapped as `BotHandlerException` (or `BotHanlderException` in .NET — the typo is preserved for backward compatibility). The wrapper carries:

- `cause` — the original exception
- `activity` — the activity that triggered the handler

---

## Cross-language behavioral invariants

These hold in every language implementation:

1. JWT validation happens before activity processing — unauthenticated requests never reach middleware or handlers
2. `createReplyActivity` copies `serviceUrl`, `channelId`, and `conversation`; swaps `from`/`recipient`; sets `replyToId`
3. Unregistered activity types are silently ignored (no error thrown)
4. Handler exceptions are wrapped in `BotHandlerException`
5. Outbound activities are authenticated with a client-credentials bearer token
6. Middleware executes in registration order

---

## Language-specific notes

| Area | .NET | Node.js | Python |
|---|---|---|---|
| Handler registration | Single `OnActivity` callback | `on(type, fn)` per-type map | `@bot.on("type")` decorator or `bot.on("type", fn)` |
| Framework integration | ASP.NET Core middleware (`UseBotApplication`) | Framework-agnostic (`botAuthExpress`, `botAuthHono`) | FastAPI `Depends` or aiohttp middleware |
| DI support | Full DI via `AddBotApplication<T>` | Not applicable | Not applicable |
| Async model | `async/await` + `CancellationToken` | `async/await` (Promise) | `async/await` (asyncio) |
| JSON serialization | `System.Text.Json` (camelCase policy) | `JSON.parse` / `JSON.stringify` | Pydantic v2 (camelCase alias) |
