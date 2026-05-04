# Language Parity Matrix

**Purpose**: Single source of truth for cross-language feature support across `.NET`, Node.js, and Python.
**Status**: Draft

This document consolidates the per-language gaps and intentional differences that were previously scattered through individual specs (e.g., the "Cross-Language Auth Parity" table in [inbound-auth.md](./inbound-auth.md), the per-flow tables in [outbound-auth.md](./outbound-auth.md), the "Available in" notes in [conversation-client.md](./conversation-client.md), and the "Language-Specific Intentional Differences" table in [README.md](./README.md)).

When adding a new language port, every row in this matrix MUST be addressed (either implement the feature, document an intentional gap, or open a tracking issue).

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented and on parity with other languages |
| 🟡 | Partial implementation OR intentionally different API surface (see Notes) |
| ❌ | Not implemented (gap) |
| ⚠️ | Intentional gap with documented rationale (see Notes) |
| — | Not applicable in this language/runtime |

> If a row contains 🟡 or ❌, the **Notes** column MUST point at the cause (spec section, source file, or rationale).

---

## 1. Core HTTP Pipeline

See [protocol.md](./protocol.md).

| Feature | .NET | Node | Python | Notes |
|---|---|---|---|---|
| `POST /api/messages` (default route) | ✅ | ✅ | ✅ | Path is configurable. |
| Success response shape `{}` | ✅ | ✅ | ✅ | |
| Auth failure → `401` | ✅ | ✅ | ✅ | |
| Handler error → `500` | ✅ | ✅ | ✅ | |
| Required-field validation (`type`, `serviceUrl`, `conversation.id`) → `400` | ✅ | ✅ | ✅ | |
| Max body size **1 MB** → `413` | ✅ | ✅ | ✅ | |
| Field-level limits (`text` 50k, `entities` 100, `attachments` 50) → `400` | 🟡 | 🟡 | 🟡 | SHOULD-level requirement; not all ports enforce every cap. |
| Prototype-pollution stripping (`__proto__`, `constructor`, `prototype`) | — | ✅ | 🟡 | .NET strongly typed; Python defense-in-depth only. |
| Case-insensitive activity-type dispatch | ✅ | ✅ | ✅ | |
| Silently ignore unregistered types | ✅ | ✅ | ✅ | |
| `GET /health` operational endpoint | ✅ | 🟡 | 🟡 | SHOULD-level. .NET `BotApp` adds it; Node/Python sample-only. |
| `GET /` human-readable status | ✅ | 🟡 | 🟡 | Same as above. |
| `processBody()` / `ProcessAsync()` web-framework-agnostic | ✅ | ✅ | ✅ | Auth is in adapter layer, not `BotApplication`. |

---

## 2. Inbound Authentication

See [inbound-auth.md](./inbound-auth.md). Source-of-truth table for issuer/JWKS behavior.

| Feature | .NET | Node | Python | Notes |
|---|---|---|---|---|
| JWT signature verification (JWKS) | ✅ | ✅ | ✅ | .NET via MSAL; Node via `jose`; Python via `PyJWT` + `httpx`. |
| Audience: bare `{CLIENT_ID}` | ✅ | ✅ | ✅ | |
| Audience: `api://{CLIENT_ID}` | ✅ | ✅ | ✅ | |
| Audience: `https://api.botframework.com` | ✅ | ✅ | ✅ | |
| Issuer: `https://api.botframework.com` | ✅ | ✅ | ✅ | |
| Issuer: `https://sts.windows.net/{tid}/` | ✅ | ✅ | ✅ | |
| Issuer: `https://login.microsoftonline.com/{tid}/v2` | ✅ | ✅ | ✅ | |
| Issuer: `https://login.microsoftonline.com/{tid}/v2.0` | 🟡 | ✅ | ✅ | **.NET single-tenant gap** — `JwtExtensions.AddCustomJwtBearer` / `AddCustomJwtBearerEx` only register `/v2`. Multi-tenant path accepts both. See [inbound-auth.md §Issuer](./inbound-auth.md#2-issuer-iss). |
| RS256-only algorithm enforcement | ✅ | ✅ | ✅ | Defense against algorithm confusion. |
| `exp` / `nbf` enforcement | ✅ | ✅ | ✅ | |
| Dynamic OpenID config URL by `iss` | ✅ | ✅ | ✅ | |
| Metadata-URL prefix allowlist (SSRF) | ✅ | ✅ | ✅ | `login.botframework.com/`, `login.microsoftonline.com/`. |
| JWKS caching keyed by metadata URL | ✅ | ✅ | ✅ | .NET via MSAL `ConfigurationManager`; Node module-level `Map` w/ 24 h TTL; Python module-level `dict` w/ `asyncio.Lock`. |
| `kid`-miss JWKS refresh + retry once | ✅ | ✅ | ✅ | .NET via MSAL; Node via `jose` `createRemoteJWKSet`; Python explicit `force_refresh=True`. |
| Auth bypass when `CLIENT_ID` not set (framework-level) | ✅ | ✅ | ✅ | Framework MUST skip middleware; validation function itself MUST still require `appId`. |
| Rate-limit failed-token validation (5 s cooldown, sha256 cache) | ❌ | ✅ | ❌ | SHOULD-level. Only Node implements it (`bot-auth-middleware.ts`). |

---

## 3. Outbound Authentication

See [outbound-auth.md](./outbound-auth.md).

### Token endpoint / default tenant

| Feature | .NET | Node | Python | Notes |
|---|---|---|---|---|
| OAuth2 client-credentials grant | ✅ | ✅ | ✅ | All three delegate to MSAL. |
| `TENANT_ID` env-var override | ✅ | ✅ | ✅ | .NET reads `AzureAd:TenantId` from `IConfiguration`. |
| Default tenant when unset | `common` (Microsoft.Identity.Web) | `botframework.com` (`TokenManager.getBotToken`) | `None` (returns `None`; OTel span placeholder is `common`) | **Intentional differences** — see [outbound-auth.md §Token Endpoint](./outbound-auth.md#token-endpoint). Set `TENANT_ID` explicitly in production. |
| Token caching | ✅ (MSAL `IAuthorizationHeaderProvider`) | ✅ (`@azure/msal-node`) | ✅ (`msal.ConfidentialClientApplication`) | |
| Negative caching (failed-acquisition cooldown) | ❌ | ✅ (30 s) | ❌ | SHOULD-level. Node also dedups concurrent in-flight acquisitions via `pendingTokenRequest`. |
| In-flight request dedup | 🟡 | ✅ | 🟡 | Node only — see `token-manager.ts:58–149`. .NET/Python rely on MSAL internals. |

### Auth flows

| Flow | .NET | Node | Python | Notes |
|---|---|---|---|---|
| Client credentials (secret) | ✅ | ✅ | ✅ | |
| User managed identity | ✅ (Microsoft.Identity.Web) | ✅ | ❌ | **Python gap** — option is read from env but not wired. Use `token_factory` with `azure-identity` as workaround. See [outbound-auth.md §Alternative Authentication Flows](./outbound-auth.md#alternative-authentication-flows). |
| Federated identity (user-assigned MI) | ✅ (Microsoft.Identity.Web) | ✅ | ❌ | Python gap — same as above. |
| Federated identity (system-assigned MI, `MANAGED_IDENTITY_CLIENT_ID="system"`) | ✅ (Microsoft.Identity.Web) | ✅ | ❌ | Python gap — same as above. |
| Custom token factory / callback | ✅ `Func<string, string, Task<string>>` | ✅ `(scope, tenantId) => Promise<string>` | ✅ `Callable[[str, str], Awaitable[str]]` | |
| Factory return-value validation (reject empty/null) | ❌ | ❌ | ❌ | Documented contract — not enforced at runtime. See [outbound-auth.md](./outbound-auth.md#token-factory-callback-signature). |

---

## 4. Activity Schema

See [activity-schema.md](./activity-schema.md).

| Feature | .NET | Node | Python | Notes |
|---|---|---|---|---|
| `CoreActivity` typed model | ✅ class w/ `[JsonExtensionData]` | ✅ interface w/ `properties?` | ✅ Pydantic model w/ `model_extra` | |
| Extension-data round-trip on root activity | ✅ | ✅ | ✅ | |
| Extension-data round-trip on sub-objects (`ChannelAccount`, `Conversation`, Teams models) | ✅ | ✅ | ✅ | |
| `from` field name | `From` | `from` | `from_account` | `from` is reserved in Python; serializes to/from JSON `"from"` via `@model_validator(mode="before")`. |
| `new CoreActivity()` default `type` | `"message"` | `""` | `""` | **Intentional .NET difference** — primary constructor convenience. Other languages MUST default to empty string. |
| Required field non-optional at type level (`ChannelAccount.id`, `Conversation.id`) | ✅ | ✅ | ✅ | |
| `serviceUrl` trailing-slash normalization on outbound URL | ✅ | ✅ | ✅ | |
| URL-encode full conversation ID (preserve `;`) | ✅ | 🟡 | 🟡 | Node/Python truncate at `;` per [conversation-client.md §Conversation ID Encoding](./conversation-client.md#conversation-id-encoding) — diverges from `protocol.md` guidance. |

---

## 5. Builder Pattern

See [core-activity-builder.md](./core-activity-builder.md) and [teams-activity.md](./teams-activity.md).

| Feature | .NET | Node | Python | Notes |
|---|---|---|---|---|
| `CoreActivityBuilder` fluent API | ✅ | ✅ | ✅ | PascalCase / camelCase / snake_case respectively. |
| `withConversationReference` (copy + swap from/recipient) | ✅ | ✅ | ✅ | |
| `withType`, `withText`, `withServiceUrl`, `withConversation`, `withFrom`, `withRecipient`, `withEntities`, `withAttachments` | ✅ | ✅ | ✅ | |
| Builder defaults (`type="message"`, `text=""`) | ✅ | ✅ | ✅ | |
| `build()` returns independent copy (deep-clone routing fields) | ✅ | ✅ | ✅ | |
| `TeamsActivityBuilder` standalone (NOT extending core) | ✅ | ✅ | ✅ | |
| Teams helpers: `WithChannelData`, `WithSuggestedActions`, `AddMention`, `AddAdaptiveCardAttachment`, `WithAdaptiveCardAttachment`, `AddAttachment`, `AddEntity` | ✅ | ✅ | ✅ | |
| `AddMention` does NOT modify `text` | ✅ | ✅ | ✅ | Caller MUST add `<at>Name</at>` via `WithText`. |
| Adaptive-card attachment accepts string or object | ✅ | ✅ | ✅ | |

---

## 6. Turn Context

See [turn-context.md](./turn-context.md).

| Feature | .NET | Node | Python | Notes |
|---|---|---|---|---|
| `TurnContext.activity` / `Activity` | ✅ | ✅ | ✅ | |
| `TurnContext.app` / `App` | ✅ | ✅ | ✅ | |
| `BotApplication.version` (static) | ✅ | ✅ | ✅ | |
| `BotApplication.appId` (instance, from token manager) | ✅ | ✅ | ✅ | Python uses `appid` (lowercase). |
| `send(string)` overload | ✅ `SendAsync(string)` | ✅ | ✅ | |
| `send(activity)` overload | ✅ `SendAsync(CoreActivity)` | ✅ `Partial<CoreActivity>` | ✅ `CoreActivity \| dict` | |
| Auto-populate routing fields (`serviceUrl`, `conversation`) | ✅ | ✅ | ✅ | `from` / `recipient` NOT auto-populated. |
| Pass-through user-set fields unchanged | ✅ | ✅ | ✅ | |
| `sendTyping()` | ✅ returns `Task<string>` | ✅ returns `Promise<void>` | ✅ returns `None` | **Intentional return-type difference** documented in [README.md](./README.md#language-specific-intentional-differences). |
| Same `TurnContext` flows through middleware → handler | ✅ | ✅ | ✅ | |

---

## 7. Invoke Activities

See [invoke-activities.md](./invoke-activities.md).

| Feature | .NET | Node | Python | Notes |
|---|---|---|---|---|
| Invoke dispatch by `activity.name` | ✅ | ✅ | ✅ | |
| Case-insensitive name matching (lowercase normalization on register) | ✅ | ✅ | ✅ | |
| `InvokeResponse { status, body? }` translated to HTTP | ✅ | ✅ | ✅ | |
| Specific match → handler runs | ✅ | ✅ | ✅ | |
| No match → `501 Not Implemented` | ✅ | ✅ | ✅ | |
| No invoke handlers registered → `200` w/ `{}` | ✅ | ✅ | ✅ | Distinguishes "doesn't use invoke" from "unrecognized name". |
| Invoke ALWAYS bypasses CatchAll handler | ✅ | ✅ | ✅ | |
| Handler exception → wrapped + HTTP 500 | ✅ | ✅ | ✅ | Wrapped as `BotHandlerException`. |
| Missing return value → `InvokeResponse { status: 500 }` | ✅ | ✅ | ✅ | SHOULD-level. |

---

## 8. ConversationClient

See [conversation-client.md](./conversation-client.md). **.NET implements `Send` only**; the rest is tracked in the .NET backlog.

| Method | .NET | Node | Python | Notes |
|---|---|---|---|---|
| Send activity | ✅ | ✅ | ✅ | .NET embeds `serviceUrl`/`conversationId` in `CoreActivity`; Node/Python pass them as separate args. |
| Update activity | ❌ | ✅ | ✅ | .NET backlog. |
| Delete activity | ❌ | ✅ | ✅ | .NET backlog. |
| Get conversation members | ❌ | ✅ | ✅ | .NET backlog. |
| Get conversation member (by ID) | ❌ | ✅ | ✅ | .NET backlog. |
| Get paged members | ❌ | ✅ | ✅ | .NET backlog. |
| Delete conversation member | ❌ | ✅ | ✅ | .NET backlog. |
| Create conversation | ❌ | ✅ | ✅ | .NET backlog. |
| Get conversations | ❌ | ✅ | ✅ | .NET backlog. |
| Send conversation history (transcript upload) | ❌ | ✅ | ✅ | .NET backlog. |
| Get conversation | ❌ | ✅ | ✅ | .NET backlog. |
| Service URL allowlist enforcement before HTTP | ✅ | ✅ | ✅ | Validation happens in `ConversationClient`, not on inbound. |
| Public access for proactive messaging | ✅ DI-injected | ✅ `bot.conversationClient` | ✅ `bot.conversation_client` | See §9. |

---

## 9. Proactive Messaging

See [proactive-messaging.md](./proactive-messaging.md).

| Feature | .NET | Node | Python | Notes |
|---|---|---|---|---|
| `BotApplication.SendActivityAsync` (turn-independent) | ✅ single `CoreActivity` arg (carries `serviceUrl` + `conversationId`) | ✅ `(serviceUrl, conversationId, activity)` | ✅ `(service_url, conversation_id, activity)` | Argument-list difference is intentional and documented in [README.md](./README.md). |
| Public `ConversationClient` for direct API access | 🟡 DI-injected only | ✅ `bot.conversationClient` | ✅ `bot.conversation_client` | .NET advanced clients pull from DI rather than a property; functionally equivalent for proactive scenarios but ergonomically different. |
| Token acquisition automatic for proactive sends | ✅ | ✅ | ✅ | Same `TokenManager` as turn-based replies. |

---

## 10. Teams Activity

See [teams-activity.md](./teams-activity.md).

| Feature | .NET | Node | Python | Notes |
|---|---|---|---|---|
| `TeamsActivity` extends `CoreActivity` w/ Teams fields | ✅ | ✅ | ✅ | No C# `new` shadowing — explicit cast at use site. |
| `TeamsActivity.FromActivity(CoreActivity)` factory | ✅ | ✅ | ✅ | |
| `TeamsActivity.CreateBuilder()` factory | ✅ | ✅ | ✅ | |
| `TeamsActivity.AddEntity(Entity)` instance helper | ✅ | ✅ | ✅ | |
| Teams sub-types (`TeamsChannelAccount`, `TeamsConversation`, `TeamsChannelData`, `TenantInfo`, `ChannelInfo`, `TeamInfo`, `MeetingInfo`, `NotificationInfo`) | ✅ | ✅ | ✅ | All preserve extension data. |
| `SuggestedActions` + `CardAction` | ✅ | ✅ | ✅ | |
| `MentionEntity` w/ top-level `mentioned` and `text` | ✅ | ✅ | ✅ | NOT nested inside extension bag. |
| Teams JSON serializes identically to `CoreActivity` (camelCase, extensions preserved) | ✅ | ✅ | ✅ | |

---

## 11. Middleware

See [protocol.md §Middleware](./protocol.md#middleware).

| Feature | .NET | Node | Python | Notes |
|---|---|---|---|---|
| Registration order preserved | ✅ | ✅ | ✅ | |
| Pre- and post-`next()` semantics | ✅ | ✅ | ✅ | |
| Short-circuit by skipping `next()` | ✅ | ✅ | ✅ | |
| Activity-mutation persists through pipeline | ✅ | ✅ | ✅ | |
| Same `TurnContext` instance shared end-to-end | ✅ | ✅ | ✅ | |
| Exception propagates back through chain (each `next()` throws) | ✅ | ✅ | ✅ | |
| Detached `next()` rejection suppression | ✅ | ✅ | ✅ | SHOULD-level. |
| Middleware interface name | `ITurnMiddleWare` (capital W) | `TurnMiddleware` (legacy `ITurnMiddleware` removed) | `TurnMiddleware` (alias `ITurnMiddleware` kept) | Naming convention preserved per language. |
| `Use()` chaining return | `void` | `this` (chainable) | `None` | |
| `RemoveMentionMiddleware` ships in core | ✅ | ✅ | ✅ | Uses `app.appId` w/ fallback to `activity.recipient.id`; case-insensitive matching. |

---

## 12. Observability

See [observability.md](./observability.md). All custom spans use the `botas` ActivitySource / Tracer / Meter.

### Custom spans

| Span | .NET | Node | Python | Notes |
|---|---|---|---|---|
| `botas.turn` | ✅ | ✅ | ✅ | Full pipeline. |
| `botas.middleware` (per middleware execution) | ✅ | ✅ | ✅ | Children of `botas.turn`. |
| `botas.handler` (dispatch + execution) | ✅ | ✅ | ✅ | |
| `botas.auth.inbound` (JWT validation) | ✅ | ✅ | ✅ | Emitted by adapter layer (ASP.NET auth middleware / `botAuthExpress` / `bot_auth_dependency`). |
| `botas.auth.outbound` (token acquisition) | ✅ | ✅ | ✅ | |
| `botas.conversation_client` (outbound API call) | ✅ | ✅ | ✅ | |

### Custom metrics

| Metric | .NET | Node | Python | Notes |
|---|---|---|---|---|
| `botas.activities.received` (Counter) | ✅ | ✅ | ✅ | |
| `botas.turn.duration` (Histogram, ms) | ✅ | ✅ | ✅ | |
| `botas.handler.errors` (Counter) | ✅ | ✅ | ✅ | |
| `botas.middleware.duration` (Histogram, ms) | ✅ | ✅ | ✅ | |
| `botas.outbound.calls` (Counter) | ✅ | ✅ | ✅ | |
| `botas.outbound.errors` (Counter) | ✅ | ✅ | ✅ | |

### Distro / setup

| Concern | .NET | Node | Python | Notes |
|---|---|---|---|---|
| Microsoft OTel distro package | `Microsoft.OpenTelemetry` | `@microsoft/opentelemetry` | `microsoft-opentelemetry` | |
| AI/LLM tracing helper | n/a | `LangChainOtelCallbackHandler` | Manual `tracer.start_as_current_span` | Different abstractions per ecosystem; functionally equivalent in `05-observability` samples. |

---

## 13. Error Handling

See [protocol.md §Error Wrapping](./protocol.md#error-wrapping) and [future/on-turn-error.md](./future/on-turn-error.md).

| Feature | .NET | Node | Python | Notes |
|---|---|---|---|---|
| `BotHandlerException` wrapper (carries inner cause + activity) | ✅ | ✅ | ✅ | Class name identical across languages. |
| Cancellation re-thrown unwrapped | ✅ `OperationCanceledException` | ✅ `AbortError` | ✅ `asyncio.CancelledError` | |
| CatchAll handler exceptions wrapped same as per-type | ✅ | ✅ | ✅ | |
| Errors propagate from `processBody()` to caller | ✅ | 🟡 | ✅ | Node's `processAsync` HTTP helper SWALLOWS errors into 500 + debug log — see [future/on-turn-error.md](./future/on-turn-error.md). |
| `onTurnError` hook for handler/middleware error visibility | ⚠️ Not required (errors propagate) | ❌ Planned (see future spec) | ⚠️ Not required (errors propagate) | Initial scope: Node-only because `processAsync` is the swallower. .NET/Python signatures drafted in future spec for later parity if needed. |
| `processAsync` re-throws after writing 500 (for outer middleware) | — | ✅ | — | Implemented Node-side per PR #333. |

---

## 14. Configuration

See [configuration.md](./configuration.md).

### Environment variables

| Variable | .NET | Node | Python | Notes |
|---|---|---|---|---|
| `CLIENT_ID` | 🟡 via `AzureAd:ClientId` | ✅ | ✅ | .NET reads `IConfiguration` keys, NOT raw env vars. Use `AzureAd__ClientId` env form. |
| `CLIENT_SECRET` | 🟡 via `AzureAd:ClientSecret` | ✅ | ✅ | Same as above. |
| `TENANT_ID` | 🟡 via `AzureAd:TenantId` | ✅ | ✅ | Same as above. |
| `MANAGED_IDENTITY_CLIENT_ID` | 🟡 via Microsoft.Identity.Web config | ✅ | ✅ (read but not wired — see §3) | |
| `ALLOWED_SERVICE_URLS` | ❌ | ✅ | ✅ | Read by inbound auth middleware in Node/Python; .NET does not read it. |
| `PORT` | ✅ (ASP.NET hosting) | ✅ | ✅ | Default `3978`. |
| `OTEL_*` standard variables | ✅ | ✅ | ✅ | See [observability.md](./observability.md). |

### Programmatic configuration

| Concern | .NET | Node | Python | Notes |
|---|---|---|---|---|
| Simple bot factory | `BotApp.Create(args)` | `new BotApp()` (`botas-express`) | `BotApp()` (`botas_fastapi`) | |
| Advanced API | `AddBotApplication<T>()` (DI) | `new BotApplication(options)` | `BotApplication(options=BotApplicationOptions(...))` | |
| Options object | DI + `IConfiguration` | `BotApplicationOptions` interface | `BotApplicationOptions` dataclass | |
| Defers `Build()` until `Run()` | ✅ Intentional (DI host needs `WebApplicationBuilder.Build()` first) | ❌ Immediate | ❌ Immediate | See [README.md](./README.md#language-specific-intentional-differences) for rationale. |
| Custom auth-token override | DI / token factory | `token` callback option | `token_factory` option | |

### Web framework integration

| Framework | Helper | Where it lives |
|---|---|---|
| ASP.NET Core | `AddBotApplication<T>()` | .NET — registers JWT bearer scheme via Microsoft.Identity.Web. |
| Express | `botAuthExpress()` | Node — `botas-express`. |
| Hono | `botAuthHono()` | Node — `botas-express`. |
| Koa | sample-only adapter | Node — see `samples/02-advanced-hosting-koa`. |
| Deno | `@botas/core` from JSR | Node — see `samples/02-advanced-hosting-deno`. |
| FastAPI | `bot_auth_dependency()` | Python — `botas-fastapi`. |
| aiohttp | `validate_bot_token(header)` | Python — `botas.bot_auth` (manual). |
| Flask | sample-only adapter | Python — see `samples/02-advanced-hosting-flask`. |

---

## 15. Resource Cleanup

See [protocol.md §Resource Cleanup](./protocol.md#resource-cleanup).

| Feature | .NET | Node | Python | Notes |
|---|---|---|---|---|
| HTTP-client lifetime managed by runtime | ✅ via `IHttpClientFactory` / DI | ✅ via built-in `fetch` | 🟡 `httpx.AsyncClient` requires explicit close | |
| Shutdown hook needed in user code | ❌ Not needed | ❌ Not needed | ✅ `async with bot:` or `await bot.aclose()` | Documented in protocol spec; without it, `httpx` connections leak (audit finding). |
| `__aenter__` / `__aexit__` (async context manager) | — | — | ✅ | Python-only. |
| `aclose()` explicit cleanup method | — | — | ✅ | Python-only. |
| FastAPI lifespan / shutdown wiring required | — | — | ✅ MUST be wired by user | Sample `01-echo-bot` shows the pattern. |

---

## How to update this matrix

1. When you change behavior in one language, update the matrix in the same PR.
2. When you add a new spec, link rows here back to the relevant section in that spec — do NOT duplicate prose.
3. When a row goes from 🟡/❌ → ✅, also remove the corresponding language-specific gap callout from the source spec to avoid drift.
4. For brand-new ports, copy the matrix and fill every row before opening the port PR.

---

## References

- [README.md](./README.md) — high-level spec index and intentional API differences
- [protocol.md](./protocol.md), [inbound-auth.md](./inbound-auth.md), [outbound-auth.md](./outbound-auth.md) — authoritative behavior
- [activity-schema.md](./activity-schema.md), [conversation-client.md](./conversation-client.md), [turn-context.md](./turn-context.md) — typed APIs
- [observability.md](./observability.md) — custom spans + metrics
- [future/on-turn-error.md](./future/on-turn-error.md) — Node-specific error-visibility hook
- [AGENTS.md](../AGENTS.md) — porting guide and behavioral invariants
