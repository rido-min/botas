# .NET API Reference

API reference for the **Botas** .NET library, extracted from XML documentation comments in [`dotnet/src/Botas/`](https://github.com/rido-min/botas/tree/main/dotnet/src/Botas).

**Package:** `Botas` (NuGet)  
**Namespace:** `Botas`

---

## BotApp

Zero-boilerplate bot host that wraps ASP.NET Core setup. The simplest way to get a bot running.

```csharp
public class BotApp
```

| Member | Signature | Description |
|--------|-----------|-------------|
| `Bot` | `BotApplication? Bot { get; }` | The underlying `BotApplication` after `Run()` is called. |
| `Create` | `static BotApp Create(string[]? args = null, string routePath = "api/messages")` | Create a new bot host with optional CLI args and route path. |
| `On` | `BotApp On(string type, Func<TurnContext, CancellationToken, Task> handler)` | Register an activity handler by type (e.g. `"message"`). |
| `OnInvoke` | `BotApp OnInvoke(string name, Func<TurnContext, CancellationToken, Task<InvokeResponse>> handler)` | Register a named invoke handler. |
| `Use` | `BotApp Use(ITurnMiddleWare middleware)` | Add a middleware to the pipeline. |
| `Run` | `void Run()` | Build, configure, and start the bot host. |

---

## BotApplication

Core bot application that manages the middleware pipeline, handler dispatch, and outbound messaging.

```csharp
public class BotApplication
```

### Constructors

| Signature | Description |
|-----------|-------------|
| `BotApplication()` | Creates an instance with default (empty) configuration. |
| `BotApplication(IConfiguration config, ILogger<BotApplication> logger, string serviceKey = "AzureAd")` | Creates an instance with DI-injected configuration and logging. |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `Version` | `static string` | SDK version string. |
| `OnActivity` | `Func<TurnContext, CancellationToken, Task>?` | Catch-all activity handler (legacy API). |
| `AppId` | `string?` | Azure AD client/application ID. |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `On` | `BotApplication On(string type, Func<TurnContext, CancellationToken, Task> handler)` | Register a handler for a specific activity type. |
| `OnInvoke` | `BotApplication OnInvoke(string name, Func<TurnContext, CancellationToken, Task<InvokeResponse>> handler)` | Register a named invoke handler. |
| `ProcessAsync` | `Task<CoreActivity> ProcessAsync(HttpContext httpContext, CancellationToken ct)` | Process an incoming HTTP request through the full pipeline. |
| `Use` | `ITurnMiddleWare Use(ITurnMiddleWare middleware)` | Add middleware to the pipeline. |
| `SendActivityAsync` | `Task<string> SendActivityAsync(CoreActivity activity, CancellationToken ct)` | Send an outbound activity via the Bot Framework API. |

---

## TurnContext

Per-turn context passed to handlers and middleware. Provides access to the incoming activity and reply helpers.

```csharp
public class TurnContext
```

| Member | Signature | Description |
|--------|-----------|-------------|
| `Activity` | `CoreActivity Activity { get; }` | The incoming activity for this turn. |
| `App` | `BotApplication App { get; }` | The bot application processing this turn. |
| `SendAsync` | `Task<string> SendAsync(string text, CancellationToken ct)` | Reply with a text message. |
| `SendAsync` | `Task<string> SendAsync(CoreActivity activity, CancellationToken ct)` | Reply with a full activity. |
| `SendTypingAsync` | `Task<string> SendTypingAsync(CancellationToken ct)` | Send a typing indicator. |

---

## ConversationClient

Outbound Bot Framework REST API client with SSRF protection.

```csharp
public class ConversationClient
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `SendActivityAsync` | `Task<string> SendActivityAsync(CoreActivity activity, CancellationToken ct)` | Send an activity to a conversation. |

---

## CoreActivity

Bot Framework activity payload. Supports unknown JSON property round-tripping via `Properties`.

```csharp
public class CoreActivity
```

### Constructor

```csharp
public CoreActivity(string type = "message")
```

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `Type` | `string` | Activity type (e.g. `"message"`, `"typing"`). |
| `ServiceUrl` | `string?` | Bot Framework service URL for replies. |
| `Name` | `string?` | Activity name (used by invoke/event). |
| `Value` | `object?` | Activity value payload. |
| `Text` | `string?` | Text content of the activity. |
| `From` | `ChannelAccount?` | Sender account. |
| `Recipient` | `ChannelAccount?` | Recipient account. |
| `Conversation` | `Conversation?` | Conversation reference. |
| `Entities` | `JsonArray?` | Entity metadata (mentions, etc.). |
| `Attachments` | `JsonArray?` | File/card attachments. |
| `Properties` | `ExtendedPropertiesDictionary` | Unknown JSON properties (round-trip safe). |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `ToJson` | `string ToJson()` | Serialize to JSON string. |
| `FromJsonString` | `static CoreActivity FromJsonString(string json)` | Deserialize from JSON string. |
| `FromJsonStreamAsync` | `static ValueTask<CoreActivity?> FromJsonStreamAsync(Stream stream, CancellationToken ct)` | Deserialize from a stream. |

---

## CoreActivityBuilder

Fluent builder for constructing outbound `CoreActivity` instances.

```csharp
public class CoreActivityBuilder
```

| Method | Returns | Description |
|--------|---------|-------------|
| `WithConversationReference(CoreActivity source)` | `CoreActivityBuilder` | Copy conversation reference from a source activity. |
| `WithType(string type)` | `CoreActivityBuilder` | Set the activity type. |
| `WithServiceUrl(string serviceUrl)` | `CoreActivityBuilder` | Set the service URL. |
| `WithConversation(Conversation conversation)` | `CoreActivityBuilder` | Set the conversation. |
| `WithFrom(ChannelAccount from)` | `CoreActivityBuilder` | Set the sender. |
| `WithRecipient(ChannelAccount recipient)` | `CoreActivityBuilder` | Set the recipient. |
| `WithText(string text)` | `CoreActivityBuilder` | Set the text content. |
| `WithEntities(JsonArray entities)` | `CoreActivityBuilder` | Set entities. |
| `WithAttachments(JsonArray attachments)` | `CoreActivityBuilder` | Set attachments. |
| `Build()` | `CoreActivity` | Build the activity. |

---

## ChannelAccount

Represents a user or bot account on a channel.

```csharp
public class ChannelAccount
```

| Property | Type | Description |
|----------|------|-------------|
| `Id` | `string?` | Account identifier. |
| `Name` | `string?` | Display name. |
| `AadObjectId` | `string?` | Azure AD object ID. |
| `Role` | `string?` | Account role. |
| `Properties` | `ExtendedPropertiesDictionary` | Extension properties. |

---

## Conversation

Represents a conversation (chat, channel, or group).

```csharp
public class Conversation
```

| Property | Type | Description |
|----------|------|-------------|
| `Id` | `string?` | Conversation identifier. |
| `Properties` | `ExtendedPropertiesDictionary` | Extension properties. |

---

## Entity

Bot Framework entity metadata (mentions, places, etc.).

```csharp
public class Entity
```

| Property | Type | Description |
|----------|------|-------------|
| `Type` | `string` | Entity type (e.g. `"mention"`). |
| `Properties` | `ExtendedPropertiesDictionary` | Extension properties. |

---

## Attachment

File or card attachment on an activity.

```csharp
public class Attachment
```

| Property | Type | Description |
|----------|------|-------------|
| `ContentType` | `string` | MIME type of the attachment. |
| `ContentUrl` | `string?` | URL to the attachment content. |
| `Content` | `object?` | Inline content (e.g. Adaptive Card JSON). |
| `Name` | `string?` | Attachment name. |
| `ThumbnailUrl` | `string?` | Thumbnail URL. |
| `Properties` | `ExtendedPropertiesDictionary` | Extension properties. |

---

## SuggestedActions

Suggested action buttons displayed to the user.

```csharp
public class SuggestedActions
```

| Property | Type | Description |
|----------|------|-------------|
| `To` | `string[]?` | Array of recipient IDs. |
| `Actions` | `CardAction[]` | Action buttons. |
| `Properties` | `ExtendedPropertiesDictionary` | Extension properties. |

---

## CardAction

A clickable action button.

```csharp
public class CardAction
```

| Property | Type | Description |
|----------|------|-------------|
| `Type` | `string` | Action type (e.g. `"imBack"`, `"openUrl"`). |
| `Title` | `string?` | Button display text. |
| `Value` | `string?` | Value sent when clicked. |
| `Text` | `string?` | Text sent to bot on click. |
| `DisplayText` | `string?` | Text displayed in chat on click. |
| `Image` | `string?` | Icon image URL. |
| `Properties` | `ExtendedPropertiesDictionary` | Extension properties. |

---

## TeamsActivity

Teams-specific activity with additional channel data and helpers. Extends `CoreActivity`.

```csharp
public class TeamsActivity : CoreActivity
```

### Additional Properties

| Property | Type | Description |
|----------|------|-------------|
| `ChannelData` | `TeamsChannelData?` | Teams-specific channel data. |
| `Timestamp` | `string?` | Activity timestamp. |
| `LocalTimestamp` | `string?` | Local timestamp. |
| `Locale` | `string?` | User locale. |
| `LocalTimezone` | `string?` | User timezone. |
| `SuggestedActions` | `SuggestedActions?` | Suggested actions. |

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `FromActivity` | `static TeamsActivity FromActivity(CoreActivity activity)` | Convert a `CoreActivity` to `TeamsActivity`. |
| `AddEntity` | `void AddEntity(Entity entity)` | Add an entity to the activity. |
| `CreateBuilder` | `static TeamsActivityBuilder CreateBuilder()` | Create a fluent builder. |
| `FromJsonString` | `static new TeamsActivity FromJsonString(string json)` | Deserialize from JSON. |
| `FromJsonStreamAsync` | `static new ValueTask<TeamsActivity?> FromJsonStreamAsync(Stream stream, CancellationToken ct)` | Deserialize from stream. |

---

## TeamsActivityBuilder

Fluent builder for constructing `TeamsActivity` instances with Teams-specific features.

```csharp
public class TeamsActivityBuilder
```

| Method | Returns | Description |
|--------|---------|-------------|
| `WithConversationReference(CoreActivity source)` | `TeamsActivityBuilder` | Copy conversation reference. |
| `WithType(string type)` | `TeamsActivityBuilder` | Set activity type. |
| `WithServiceUrl(string serviceUrl)` | `TeamsActivityBuilder` | Set service URL. |
| `WithConversation(Conversation conversation)` | `TeamsActivityBuilder` | Set conversation. |
| `WithFrom(ChannelAccount from)` | `TeamsActivityBuilder` | Set sender. |
| `WithRecipient(ChannelAccount recipient)` | `TeamsActivityBuilder` | Set recipient. |
| `WithText(string text)` | `TeamsActivityBuilder` | Set text. |
| `WithChannelData(TeamsChannelData? channelData)` | `TeamsActivityBuilder` | Set channel data. |
| `WithSuggestedActions(SuggestedActions? actions)` | `TeamsActivityBuilder` | Set suggested actions. |
| `WithEntities(JsonArray? entities)` | `TeamsActivityBuilder` | Set entities. |
| `WithAttachments(JsonArray? attachments)` | `TeamsActivityBuilder` | Set attachments. |
| `AddEntity(Entity entity)` | `TeamsActivityBuilder` | Append an entity. |
| `AddAttachment(Attachment attachment)` | `TeamsActivityBuilder` | Append an attachment. |
| `AddMention(ChannelAccount account, string? mentionText)` | `TeamsActivityBuilder` | Add an @mention entity. |
| `AddAdaptiveCardAttachment(string cardJson)` | `TeamsActivityBuilder` | Add an Adaptive Card from JSON string. |
| `AddAdaptiveCardAttachment(JsonElement content)` | `TeamsActivityBuilder` | Add an Adaptive Card from JsonElement. |
| `WithAdaptiveCardAttachment(string cardJson)` | `TeamsActivityBuilder` | Replace attachments with a single Adaptive Card. |
| `WithAdaptiveCardAttachment(JsonElement content)` | `TeamsActivityBuilder` | Replace attachments with a single Adaptive Card. |
| `Build()` | `TeamsActivity` | Build the activity. |

---

## TeamsChannelData

Teams-specific channel data attached to activities.

```csharp
public class TeamsChannelData
```

| Property | Type | Description |
|----------|------|-------------|
| `Tenant` | `TenantInfo?` | Microsoft 365 tenant info. |
| `Channel` | `ChannelInfo?` | Teams channel info. |
| `Team` | `TeamInfo?` | Teams team info. |
| `Meeting` | `MeetingInfo?` | Meeting info. |
| `Notification` | `NotificationInfo?` | Notification settings. |
| `Properties` | `ExtendedPropertiesDictionary` | Extension properties. |

---

## TeamsChannelAccount

Teams-specific channel account extending `ChannelAccount` with email and UPN.

```csharp
public class TeamsChannelAccount : ChannelAccount
```

| Property | Type | Description |
|----------|------|-------------|
| `Email` | `string?` | Email address. |
| `UserPrincipalName` | `string?` | Azure AD user principal name. |

---

## TeamsConversation

Teams-specific conversation extending `Conversation`.

```csharp
public class TeamsConversation : Conversation
```

| Property | Type | Description |
|----------|------|-------------|
| `ConversationType` | `string?` | Conversation type (personal, groupChat, channel). |
| `TenantId` | `string?` | Microsoft 365 tenant ID. |
| `IsGroup` | `bool?` | Whether it's a group conversation. |
| `Name` | `string?` | Conversation display name. |

---

## RemoveMentionMiddleware

Middleware that strips the bot's own `@mention` text from incoming messages.

```csharp
public class RemoveMentionMiddleware : ITurnMiddleWare
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `OnTurnAsync` | `Task OnTurnAsync(TurnContext context, NextDelegate next, CancellationToken ct)` | Remove self-mentions from activity text, then call next. |

---

## Support Types

### TenantInfo
| Property | Type | Description |
|----------|------|-------------|
| `Id` | `string?` | Tenant identifier. |

### ChannelInfo
| Property | Type | Description |
|----------|------|-------------|
| `Id` | `string?` | Channel identifier. |
| `Name` | `string?` | Channel name. |

### TeamInfo
| Property | Type | Description |
|----------|------|-------------|
| `Id` | `string?` | Team identifier. |
| `Name` | `string?` | Team name. |
| `AadGroupId` | `string?` | Azure AD group ID. |

### MeetingInfo
| Property | Type | Description |
|----------|------|-------------|
| `Id` | `string?` | Meeting identifier. |

### NotificationInfo
| Property | Type | Description |
|----------|------|-------------|
| `Alert` | `bool?` | Whether to show alert notification. |

---

## Extension Methods

### JwtExtensions

Authentication setup helpers for ASP.NET Core.

```csharp
public static class JwtExtensions
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `AddBotAuthentication` | `AuthenticationBuilder AddBotAuthentication(this IServiceCollection services, string aadSectionName = "AzureAd")` | Add JWT bearer authentication for bot inbound requests. |
| `AddBotAuthorization` | `AuthorizationBuilder AddBotAuthorization(this IServiceCollection services)` | Add bot authorization policy. |

### AppBuilderExtensions

ASP.NET Core middleware pipeline extensions.

```csharp
public static class AppBuilderExtensions
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `UseBotApplication<TApp>` | `TApp UseBotApplication<TApp>(this IApplicationBuilder builder, string routePath = "api/messages", string authorizationPolicy = "DefaultPolicy")` | Map the bot endpoint with DI-resolved application. |
| `UseBotApplication<TApp>` | `TApp UseBotApplication<TApp>(this IApplicationBuilder builder, TApp app, string routePath = "api/messages", string authorizationPolicy = "DefaultPolicy")` | Map the bot endpoint with an explicit application instance. |

### BotApplicationConfigurationExtensions

DI service registration helpers.

```csharp
public static class BotApplicationConfigurationExtensions
```

| Method | Signature | Description |
|--------|-----------|-------------|
| `AddBotApplication<TApp>` | `IServiceCollection AddBotApplication<TApp>(this IServiceCollection services)` | Register a bot application type in DI. |
| `AddBotApplication<TApp>` | `IServiceCollection AddBotApplication<TApp>(this IServiceCollection services, TApp app)` | Register an existing bot application instance in DI. |
| `AddBotApplicationClients` | `IServiceCollection AddBotApplicationClients(this IServiceCollection services, string aadConfigSectionName = "AzureAd")` | Register HTTP clients and token management for outbound calls. |

---

## ExtendedPropertiesDictionary

Dictionary that captures unknown JSON properties during deserialization, enabling safe round-tripping.

```csharp
public class ExtendedPropertiesDictionary : Dictionary<string, object?>
```

---

See also: [.NET Language Guide](/languages/dotnet) · [Getting Started](/getting-started) · [Source on GitHub](https://github.com/rido-min/botas/tree/main/dotnet/src/Botas)
