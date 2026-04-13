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
       ├─ middleware[0](context, next)
       ├─ middleware[1](context, next)
       ├─ ...
       └─ handler dispatch    call handler registered for activity.type
                              (silently ignore if no handler registered)
```

Middleware executes in registration order. Each middleware calls `next()` to continue; omitting the call short-circuits the pipeline.

---

## Two-auth model

The library uses separate authentication for each direction:

- **Inbound**: Validate the JWT bearer token on every `POST /api/messages` before the activity reaches middleware or handlers. Returns `401` on failure. See [Inbound Auth spec](./specs/inbound-auth.md) for issuer selection, JWKS discovery, and validation rules.
- **Outbound**: Acquire an OAuth2 client-credentials token before every outbound API call. `TokenManager` handles acquisition and caching. See [Outbound Auth spec](./specs/outbound-auth.md) for the token endpoint, parameters, and caching strategy.

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
│    (node/python — explicit params)                  │
│  SendActivityAsync(coreActivity)                    │
│    (dotnet — serviceUrl/conversationId embedded)    │
│                                                     │
│  ● Silently skips trace activities                   │
│  ● TokenManager acquires/caches outbound token      │
│    → POST {serviceUrl}v3/conversations/{id}/        │
│           activities                                │
└─────────────────────────────────────────────────────┘
```

### Supporting components

| Component | Purpose |
|---|---|
| `TokenManager` | OAuth2 client-credentials token acquisition and caching |
| `CoreActivityBuilder` | Fluent builder — `withConversationReference` copies routing fields, swaps from/recipient; `withText` sets message text |

---

## Activity schema

The core `CoreActivity` type carries the minimum typed fields for a single turn. All other properties from the wire payload are preserved in an extension dictionary.

See [Activity Schema spec](./specs/activity-schema.md) for the full field listing, serialization rules, and examples.

---

## Handler dispatch

Handlers are registered by activity type. When an activity arrives, the matching handler is called; unregistered types are silently ignored. See [Protocol spec — Handler Dispatch](./specs/protocol.md#handler-dispatch) for the full contract.

- **Node.js / Python**: per-type map via `on(type, handler)`
- **.NET**: single `OnActivity` callback; dispatch logic lives in application code

---

## Error handling

Any exception thrown inside a handler is caught and re-thrown wrapped as `BotHandlerException` (or `BotHanlderException` in .NET — the typo is preserved for backward compatibility). See [Protocol spec — Error Wrapping](./specs/protocol.md#error-wrapping) for details.

---

## Cross-language behavioral invariants

These hold in every language implementation. See [AGENTS.md — Behavioral Invariants](../AGENTS.md#behavioral-invariants) for the full list.

Key invariants: JWT validation before processing, `CoreActivityBuilder.withConversationReference` routing-field semantics, silent ignore of unregistered activity types, handler exception wrapping, outbound client-credentials auth, middleware registration-order execution, and silent skipping of outbound `trace` activities.

---

## Language-specific notes

| Area | .NET | Node.js | Python |
|---|---|---|---|
| Handler registration | Single `OnActivity` callback | `on(type, fn)` per-type map | `@bot.on("type")` decorator or `bot.on("type", fn)` |
| Framework integration | ASP.NET Core middleware (`UseBotApplication`) | Framework-agnostic (`botAuthExpress`, `botAuthHono`) | FastAPI `Depends` or aiohttp middleware |
| DI support | Full DI via `AddBotApplication<T>` | Not applicable | Not applicable |
| Async model | `async/await` + `CancellationToken` | `async/await` (Promise) | `async/await` (asyncio) |
| JSON serialization | `System.Text.Json` (camelCase policy) | `JSON.parse` / `JSON.stringify` | Pydantic v2 (camelCase alias) |
