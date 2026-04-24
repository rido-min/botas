---
outline: deep
---

# API Reference

This page provides a comprehensive overview of all public types and modules in the botas library across all supported languages.

Each language implementation maintains behavioral parity while following language-specific idioms. For detailed API documentation, click on any type below.

## .NET (C#)

The .NET implementation is distributed as the **Botas** NuGet package. All types are in the `Botas` namespace.

### Core

| Type | Description |
|------|-------------|
| [BotApplication](/api/generated/dotnet/api/Botas.BotApplication.html) | Core bot application with middleware pipeline and handler dispatch |
| [BotApp](/api/generated/dotnet/api/Botas.BotApp.html) | Zero-boilerplate bot host for ASP.NET Core |
| [TurnContext](/api/generated/dotnet/api/Botas.TurnContext.html) | Single turn context (activity + send methods) |
| [BotHandlerException](/api/generated/dotnet/api/Botas.BotHandlerException.html) | Exception wrapping for handler errors |
| [ITurnMiddleWare](/api/generated/dotnet/api/Botas.ITurnMiddleWare.html) | Middleware pipeline interface |
| [NextDelegate](/api/generated/dotnet/api/Botas.NextDelegate.html) | Advances middleware pipeline |

### Activities & Models

| Type | Description |
|------|-------------|
| [CoreActivity](/api/generated/dotnet/api/Botas.CoreActivity.html) | Bot Framework activity (the fundamental unit) |
| [CoreActivityBuilder](/api/generated/dotnet/api/Botas.CoreActivityBuilder.html) | Fluent builder for outbound activities |
| [ActivityType](/api/generated/dotnet/api/Botas.ActivityType.html) | Core activity type string constants |
| [ChannelAccount](/api/generated/dotnet/api/Botas.ChannelAccount.html) | User/bot/participant identity |
| [Conversation](/api/generated/dotnet/api/Botas.Conversation.html) | Conversation identifier |
| [Attachment](/api/generated/dotnet/api/Botas.Attachment.html) | File or rich card attachment |
| [Entity](/api/generated/dotnet/api/Botas.Entity.html) | Semantic entity (mention, place, etc.) |
| [SuggestedActions](/api/generated/dotnet/api/Botas.SuggestedActions.html) | Quick-reply buttons |
| [CardAction](/api/generated/dotnet/api/Botas.CardAction.html) | Actionable button for suggested actions |
| [InvokeResponse](/api/generated/dotnet/api/Botas.InvokeResponse.html) | Response from invoke handler |
| [ExtendedPropertiesDictionary](/api/generated/dotnet/api/Botas.ExtendedPropertiesDictionary.html) | Unknown JSON property round-tripping |

### Teams-Specific

| Type | Description |
|------|-------------|
| [TeamsActivity](/api/generated/dotnet/api/Botas.TeamsActivity.html) | Teams-specific activity with channel data |
| [TeamsActivityBuilder](/api/generated/dotnet/api/Botas.TeamsActivityBuilder.html) | Fluent builder for Teams activities |
| [TeamsActivityType](/api/generated/dotnet/api/Botas.TeamsActivityType.html) | Extended activity type constants for Teams |
| [TeamsChannelAccount](/api/generated/dotnet/api/Botas.TeamsChannelAccount.html) | Teams user with email/UPN |
| [TeamsChannelData](/api/generated/dotnet/api/Botas.TeamsChannelData.html) | Teams channel data (tenant, team, etc.) |
| [TeamsConversation](/api/generated/dotnet/api/Botas.TeamsConversation.html) | Teams conversation with metadata |
| [ChannelInfo](/api/generated/dotnet/api/Botas.ChannelInfo.html) | Teams channel info |
| [TeamInfo](/api/generated/dotnet/api/Botas.TeamInfo.html) | Teams team info |
| [TenantInfo](/api/generated/dotnet/api/Botas.TenantInfo.html) | Teams tenant info |
| [MeetingInfo](/api/generated/dotnet/api/Botas.MeetingInfo.html) | Teams meeting info |
| [NotificationInfo](/api/generated/dotnet/api/Botas.NotificationInfo.html) | Teams notification settings |

### HTTP & Authentication

| Type | Description |
|------|-------------|
| [ConversationClient](/api/generated/dotnet/api/Botas.ConversationClient.html) | Outbound HTTP client with SSRF protection |
| [JwtExtensions](/api/generated/dotnet/api/Botas.JwtExtensions.html) | JWT authentication configuration |

### Middleware

| Type | Description |
|------|-------------|
| [RemoveMentionMiddleware](/api/generated/dotnet/api/Botas.RemoveMentionMiddleware.html) | Strips @mention text from incoming activities |

### Configuration Extensions

| Type | Description |
|------|-------------|
| [AppBuilderExtensions](/api/generated/dotnet/api/Botas.AppBuilderExtensions.html) | Extension methods for ASP.NET Core pipeline |
| [BotApplicationConfigurationExtensions](/api/generated/dotnet/api/Botas.BotApplicationConfigurationExtensions.html) | DI container registration |

## Node.js (TypeScript)

The Node.js implementation is distributed as **botas-core** (base library) and **botas-express** (Express.js adapter).

### botas-core

Core types and functionality for building bots in Node.js.

#### Core

| Type | Description |
|------|-------------|
| [BotApplication](/api/generated/nodejs/botas-core/README#botapplication) | Core bot application with middleware pipeline and handler dispatch |
| [TurnContext](/api/generated/nodejs/botas-core/README#turncontext) | Single turn context (activity + send methods) |
| [BotHandlerException](/api/generated/nodejs/botas-core/README#bothandlerexception) | Wraps handler errors |
| [ConversationClient](/api/generated/nodejs/botas-core/README#conversationclient) | Outbound HTTP client with SSRF protection |

#### Activities & Models

| Type | Description |
|------|-------------|
| [CoreActivity](/api/generated/nodejs/botas-core/README#coreactivity) | Bot Framework activity schema |
| [ActivityType](/api/generated/nodejs/botas-core/README#activitytype) | Activity type constants |
| [TeamsActivity](/api/generated/nodejs/botas-core/README#teamsactivity) | Teams-specific activity with channel data |
| [TeamsActivityType](/api/generated/nodejs/botas-core/README#teamsactivitytype) | Teams activity type constants |

#### HTTP & Security

| Type | Description |
|------|-------------|
| [validateServiceUrl](/api/generated/nodejs/botas-core/README#validateserviceurl) | SSRF protection for service URLs |

### botas-express

Express.js adapter for zero-boilerplate bot hosting.

| Type | Description |
|------|-------------|
| [BotApp](/api/generated/nodejs/botas-express/README#botapp) | Zero-boilerplate Express bot host |

## Python

The Python implementation is distributed as **botas** (base library) and **botas-fastapi** (FastAPI adapter).

### botas

Core modules and functionality for building bots in Python.

#### Core Modules

| Module | Description |
|--------|-------------|
| [botas](/api/generated/python/botas/#botas) | Package root |
| [bot_application](/api/generated/python/botas/#botas.bot_application) | Core bot application with middleware pipeline and handler dispatch |
| [turn_context](/api/generated/python/botas/#botas.turn_context) | Single turn context (activity + send methods) |
| [conversation_client](/api/generated/python/botas/#botas.conversation_client) | Outbound HTTP client with SSRF protection |
| [core_activity](/api/generated/python/botas/#botas.core_activity) | Bot Framework activity schema |
| [i_turn_middleware](/api/generated/python/botas/#botas.i_turn_middleware) | Middleware pipeline interface |

#### Teams-Specific

| Module | Description |
|--------|-------------|
| [teams_activity](/api/generated/python/botas/#botas.teams_activity) | Teams-specific activity with channel data |

#### Actions & UI

| Module | Description |
|--------|-------------|
| [suggested_actions](/api/generated/python/botas/#botas.suggested_actions) | Quick-reply buttons |

#### Middleware

| Module | Description |
|--------|-------------|
| [remove_mention_middleware](/api/generated/python/botas/#botas.remove_mention_middleware) | Strips @mention text from incoming activities |

#### HTTP & Authentication

| Module | Description |
|--------|-------------|
| [bot_http_client](/api/generated/python/botas/#botas.bot_http_client) | Low-level HTTP client with auth |
| [bot_auth](/api/generated/python/botas/#botas.bot_auth) | JWT authentication for inbound requests |
| [token_manager](/api/generated/python/botas/#botas.token_manager) | OAuth 2.0 token management for outbound requests |

### botas-fastapi

FastAPI adapter for zero-boilerplate bot hosting.

| Module | Description |
|--------|-------------|
| [botas_fastapi](/api/generated/python/botas-fastapi/#botas_fastapi) | Package root |
| [bot_app](/api/generated/python/botas-fastapi/#botas_fastapi.bot_app) | Zero-boilerplate FastAPI bot host |
| [bot_auth](/api/generated/python/botas-fastapi/#botas_fastapi.bot_auth) | FastAPI auth dependency |

---

## Language-Specific Differences

While all implementations maintain behavioral parity, each follows its language's conventions:

- **.NET**: Uses `OnActivity` callback with custom dispatch logic; supports dependency injection
- **Node.js**: Uses `on(type, handler)` method for handler registration
- **Python**: Uses `@bot.on("type")` decorator for handler registration

For detailed behavioral invariants and cross-language consistency guarantees, see the [specs/](https://github.com/rido-min/botas/tree/main/specs) folder in the repository.
