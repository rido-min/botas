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
       └─ handler dispatch
            ├─ invoke dispatch (for invoke activities)
            │   → call handler registered for activity.name
            │   → return InvokeResponse (or 501 if no handler)
            └─ type dispatch (for all other activities)
                → call handler registered for activity.type
                  (silently ignore if no handler registered)
```

Middleware executes in registration order. Each middleware calls `next()` to continue; omitting the call short-circuits the pipeline.

---

## Two-auth model

The library uses separate authentication for each direction:

- **Inbound**: Validate the JWT bearer token on every `POST /api/messages` before the activity reaches middleware or handlers. Returns `401` on failure. See [Inbound Auth spec](./inbound-auth.md) for issuer selection, JWKS discovery, and validation rules.
- **Outbound**: Acquire an OAuth2 client-credentials token before every outbound API call. `TokenManager` handles acquisition and caching. See [Outbound Auth spec](./outbound-auth.md) for the token endpoint, parameters, and caching strategy.

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
│  onInvoke(name,fn) register invoke handler          │
│  OnActivity        single callback (.NET)            │
│                                                     │
│  processAsync / ProcessAsync / process_body          │
│    → run middleware chain                           │
│    → dispatch to handler by activity.type/name      │
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
| `TurnContext` | Context object for a single turn; exposes `send()`, `sendTyping()` helpers that auto-route replies to the originating conversation |
| `botas-express` (Node.js) | Express integration package; exports `BotApp` helper for zero-boilerplate setup with routing and auth middleware |

---

## Activity schema

The core `CoreActivity` type carries the minimum typed fields for a single turn. All other properties from the wire payload are preserved in an extension dictionary.

See [Activity Schema spec](./specs/activity-schema.md) for the full field listing, serialization rules, and examples.

---

## Handler dispatch

Handlers are registered by activity type. When an activity arrives, the matching handler is called; unregistered types are silently ignored. See [Protocol spec — Handler Dispatch](./protocol.md#handler-dispatch) for the full contract.

- **Node.js / Python**: per-type map via `on(type, handler)`
- **.NET**: single `OnActivity` callback; dispatch logic lives in application code

### Invoke activity dispatch

Invoke activities are dispatched by `activity.name` instead of `activity.type`. All three languages support `OnInvoke(name, handler)` / `onInvoke(name, handler)` / `on_invoke(name, handler)` for hierarchical dispatch.

Invoke handlers must return an `InvokeResponse` object containing an HTTP status code and optional response body. The default behavior depends on whether any invoke handlers are registered:

- **No invoke handlers registered at all** → return `200 {}` (bot doesn't handle invokes)
- **Handlers registered but no match for `activity.name`** → return `501 Not Implemented`

See [Invoke Activities spec — Dispatch Decision Table](./invoke-activities.md#quick-reference-dispatch-decision-table) for the full matrix including CatchAll interaction.

---

## Error handling

Any exception thrown inside a handler is caught and re-thrown wrapped as `BotHandlerException`. See [Protocol spec — Error Wrapping](./protocol.md#error-wrapping) for details.

---

## Security

The library implements multiple layers of defense against common attack vectors:

- **SSRF protection**: Service URLs are validated against an allowlist before outbound requests. Allowed patterns: `*.botframework.com`, `*.botframework.us`, `*.botframework.cn`, `*.trafficmanager.net`, and `localhost` (development only). See [Inbound Auth spec](./inbound-auth.md) for details.
- **JWKS cache with fallback**: JWT signing keys are cached in memory and refreshed on cache miss. Prevents DoS via repeated JWKS endpoint requests while ensuring key rotation support.
- **Request body size limits**: Implementations enforce a 1 MB request body limit to prevent memory exhaustion attacks.
- **JSON parsing hardening**: Node.js implementation blocks prototype-pollution keys (`__proto__`, `constructor`, `prototype`) during JSON parsing. Python strips these for defense-in-depth. .NET's strongly-typed deserialization naturally rejects unknown keys.

---

## Cross-language behavioral invariants

These hold in every language implementation. See [AGENTS.md](../AGENTS.md) for the full list.

Key invariants: JWT validation before processing, `CoreActivityBuilder.withConversationReference` routing-field semantics, silent ignore of unregistered activity types, handler exception wrapping, outbound client-credentials auth, middleware registration-order execution, and `InvokeResponse` return semantics for invoke handlers.

---

## Language-specific notes

| Area | .NET | Node.js | Python |
|---|---|---|---|
| Handler registration | Single `OnActivity` callback + `OnInvoke` | `on(type, fn)` + `onInvoke(name, fn)` | `@bot.on("type")` decorator + `@bot.on_invoke(name)` |
| Framework integration | ASP.NET Core middleware (`UseBotApplication`) | Framework-agnostic (`botAuthExpress`, `botAuthHono`) + `botas-express` package | FastAPI `Depends` or aiohttp middleware |
| DI support | Full DI via `AddBotApplication<T>` | Not applicable | Not applicable |
| Async model | `async/await` + `CancellationToken` | `async/await` (Promise) | `async/await` (asyncio) |
| JSON serialization | `System.Text.Json` (camelCase policy) | `JSON.parse` / `JSON.stringify` (with prototype-pollution protection) | Pydantic v2 (camelCase alias) |
