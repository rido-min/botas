# Botas Spec

**Purpose**: Enable LLM-driven implementation across programming languages.
**Status**: Draft

---

## Overview

`botas` is a lightweight library for building Microsoft Bot Service bots. This spec documents behavioral contracts for cross-language parity.

---

## Core Specs

| Spec | Purpose |
|------|---------|
| [protocol.md](./protocol.md) | HTTP contract, middleware pipeline, handler dispatch |
| [inbound-auth.md](./inbound-auth.md) | JWT validation for incoming requests |
| [outbound-auth.md](./outbound-auth.md) | OAuth 2.0 client credentials for outbound |
| [activity-schema.md](./activity-schema.md) | Activity JSON structure and serialization rules |
| [configuration.md](./configuration.md) | Environment variables and auth flow selection |

## Feature Specs

| Spec | Purpose |
|------|---------|
| [proactive-messaging.md](./proactive-messaging.md) | Out-of-turn messaging |
| [invoke-activities.md](./invoke-activities.md) | Invoke activity dispatch |
| [teams-activity.md](./teams-activity.md) | Teams-specific features (TeamsActivity, TeamsActivityBuilder) |

For **developer guides** on middleware patterns, use cases, and samples, see the [Middleware Guide](../docs-site/middleware.md).

**Aspirational/future specs** (not yet implemented) live in [specs/future/](./future/).

---

## User Stories

See [User Stories](./user-stories.md) for detailed behavioral scenarios.

---

## Language-Specific Intentional Differences

| Concern | dotnet | node | python |
|---------|--------|------|--------|
| Simple bot API | `BotApp.Create()` + `app.On()` | `BotApp` (botas-express) | `BotApp()` |
| Web framework | ASP.NET Core (built-in) | Express (via botas-express) or manual | aiohttp (built-in) or manual FastAPI |
| Handler registration | `app.On(type, handler)` receiving `TurnContext` | `app.on(type, handler)` receiving `TurnContext` | `@app.on(type)` decorator or `app.on(type, handler)` receiving `TurnContext` |
| CatchAll handler | `OnActivity` property | `onActivity` property | `on_activity` property |
| HTTP integration | `ProcessAsync(HttpContext)` | `processAsync(req, res)` or `processBody(body)` | `process_body(body)` |
| Auth middleware | ASP.NET authentication scheme | `botAuthExpress()` / `botAuthHono()` factory | `bot_auth_dependency()` / `validate_bot_token()` |
| SendActivityAsync args | Single `CoreActivity` (carries serviceUrl/conversationId) | `(serviceUrl, conversationId, activity)` | `(service_url, conversation_id, activity)` |
| TurnContext.send | `SendAsync(string)` / `SendAsync(CoreActivity)` | `send(string \| Partial<CoreActivity>)` | `send(str \| CoreActivity \| dict)` |
| TurnContext.sendTyping | `SendTypingAsync()` returns `Task<string>` | `sendTyping()` returns `Promise<void>` | `send_typing()` returns `None` |
| Exception class name | `BotHandlerException` | `BotHandlerException` | `BotHandlerException` |
| DI registration | `AddBotApplication<TApp>()` | Not applicable | Not applicable |
| Build timing | `BotApp.Create()` defers `Build()` to `Run()` — handlers/middleware queued until then | Immediate | Immediate |
| Resource cleanup | Handled by DI container | No explicit cleanup needed | `async with bot:` context manager or `await bot.aclose()` |
| Activity model | `CoreActivity` class with `[JsonExtensionData]` | `CoreActivity` interface with `properties?` dict | `CoreActivity` Pydantic model with `model_extra` |
| `CoreActivity()` default type | `"message"` (via primary constructor) | `""` (empty string) | `""` (empty string) |
| Prototype pollution | Not applicable (strongly typed) | `safeJsonParse` strips dangerous keys | SHOULD strip for defense-in-depth |
| `from` field naming | `From` (C# allows it) | `from` (JS allows it) | `from_account` (`from` is reserved in Python) |
| Configuration model | `IConfiguration` + DI (ASP.NET pattern) | `BotApplicationOptions` interface | `BotApplicationOptions` dataclass |
| `version` property | `BotApplication.Version` (static, from assembly) | `BotApplication.version` (static) | `BotApplication.version` (class attribute) |
| `appId` property | `BotApplication.AppId` (from configuration) | `bot.appId` (from token manager) | `bot.appid` (from token manager) |
| TeamsActivityBuilder design | Standalone class (not extending CoreActivityBuilder) | Standalone class | Standalone class |
| Service URL validation timing | ConversationClient (outbound only) | ConversationClient (outbound only) | ConversationClient (outbound only) |

These differences are intentional and should be preserved per language when porting.

---

## Reference Implementations

| Language | API Reference |
|----------|---------------|
| .NET | [reference/dotnet.md](./reference/dotnet.md) |
| Node.js | [reference/node.md](./reference/node.md) |
| Python | [reference/python.md](./reference/python.md) |

---

## Samples

- Echo Bot: `dotnet/samples/EchoBot/`, `node/samples/echo-bot/`, `python/samples/echo-bot/`
- Teams: `dotnet/samples/TeamsSample/`, `node/samples/teams-sample/`, `python/samples/teams-sample/`
- See [samples.md](./samples.md) for the full matrix and run commands.

---

## References

- [Architecture](./architecture.md) — design overview and component diagram
- [Contributing](./contributing.md) — behavioral invariants, CI, how to add a new language port
- [Setup](./setup.md) — Azure registration and bot credentials
