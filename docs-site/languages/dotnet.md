---
outline: deep
---

# .NET (C#)

📦 [Botas on NuGet](https://www.nuget.org/packages/Botas) · 📘 [API Reference](/api/generated/dotnet/api/Botas.html)

## Project setup

The botas library targets **.NET 10**. Add a NuGet package reference to your ASP.NET Core web project:

```xml
<ItemGroup>
<!-- allow pre-release versions -->
 <PackageReference Include="Botas" Version="0.1.*-*" /> 
</ItemGroup>
```

The library brings in `Microsoft.Identity.Web`, `Microsoft.AspNetCore.Authentication.JwtBearer`, and related identity packages automatically — you don't need to add them yourself.

---

## Quick start with BotApp

The simplest way to create a bot in .NET is to use `BotApp.Create()`. It configures ASP.NET Core, JWT authentication, and the `/api/messages` endpoint in a single call:

```csharp
using Botas;

var app = BotApp.Create(args);

app.On("message", async (ctx, ct) =>
{
    await ctx.SendAsync($"You said: {ctx.Activity.Text}", ct);
});

app.Run();
```

That's it — a fully working bot in just a few lines.

### What `BotApp.Create()` does

Under the hood, `BotApp.Create(args)` calls:

1. `WebApplication.CreateSlimBuilder(args)` — minimal ASP.NET Core host (no Razor, MVC, etc.)
2. `AddBotApplication<BotApplication>()` — registers the bot as a singleton, sets up JWT authentication, authorization policies, and authenticated HTTP clients
3. `Build()` — builds the `WebApplication`
4. `UseBotApplication<BotApplication>()` — maps `POST /api/messages`, enables auth middleware, and returns the bot instance

The returned object is a wrapper that exposes both the `BotApplication` (for handler registration) and the `WebApplication` (for running the host).

### Handler registration with `app.On()`

Use `app.On(type, handler)` to register per-activity-type handlers. The handler receives a `TurnContext` (not a raw `CoreActivity`):

```csharp
app.On("message", async (ctx, ct) =>
{
    // ctx.Activity is the incoming activity
    // ctx.SendAsync() sends a reply
    await ctx.SendAsync($"Echo: {ctx.Activity.Text}", ct);
});
```

If no handler is registered for an incoming activity type, the activity is **silently ignored** — no error is thrown.

### Sending replies with `ctx.SendAsync()`

`TurnContext.SendAsync()` is the simplest way to send a reply:

```csharp
// Send text
await ctx.SendAsync("Hello!", ct);

// Send a full activity
await ctx.SendAsync(new CoreActivity
{
    Type = "message",
    Text = "Hello!",
    Conversation = ctx.Activity.Conversation,
    ServiceUrl = ctx.Activity.ServiceUrl
}, ct);
```

`SendAsync(string)` automatically creates a properly-addressed reply with the given text. `SendAsync(CoreActivity)` sends the activity as-is through the authenticated `ConversationClient`.

---

## Advanced: Manual ASP.NET Core integration

For advanced scenarios — custom DI lifetimes, multi-bot hosting, or manual middleware configuration — you can skip `BotApp.Create()` and wire things up manually.

### `AddBotApplication<T>` — register services

Call this on `IServiceCollection` during host construction. It registers your bot as a singleton, sets up JWT authentication, authorization policies, and the authenticated HTTP clients used to call the Bot Service REST API.

```csharp
WebApplicationBuilder webAppBuilder = WebApplication.CreateSlimBuilder(args);
webAppBuilder.Services.AddBotApplication<BotApplication>();
```

Under the hood, `AddBotApplication<T>` calls:

- **`AddBotAuthorization`** — configures two JWT bearer schemes (`Bot` and `Agent`) that validate tokens from the Bot Service and your Azure AD tenant, and wires them into a `DefaultPolicy` authorization policy.
- **`AddBotApplicationClients`** — registers `ConversationClient` with pre-configured `HttpClient` instances that automatically attach an outbound OAuth2 bearer token (scope `https://api.botframework.com/.default`).

### `UseBotApplication<T>` — map the endpoint

Call this on the built `WebApplication`. It enables authentication/authorization middleware and maps `POST /api/messages` to your bot's `ProcessAsync` pipeline, protected by the `DefaultPolicy`.

```csharp
WebApplication webApp = webAppBuilder.Build();
var botApp = webApp.UseBotApplication<BotApplication>();
```

The route path and authorization policy name can be customized:

```csharp
var botApp = webApp.UseBotApplication<BotApplication>(
    routePath: "bot/incoming",
    authorizationPolicy: "MyCustomPolicy");
```

`UseBotApplication` returns the resolved `BotApplication` instance so you can configure handlers and middleware on it before calling `webApp.Run()`.

---

## Middleware

Middleware lets you inspect or transform every incoming activity before the handler runs. Implement `ITurnMiddleWare` and call `next` to continue the pipeline, or skip `next` to short-circuit:

```csharp
public class LoggingMiddleware : ITurnMiddleWare
{
    public async Task OnTurnAsync(
        TurnContext context,
        NextDelegate next,
        CancellationToken cancellationToken = default)
    {
        Console.WriteLine($">> Incoming: {context.Activity.Type}");

        await next(cancellationToken);  // continue to next middleware / handler

        Console.WriteLine($"<< Done: {context.Activity.Type}");
    }
}
```

Register middleware with `Use()`. Middleware executes in registration order:

```csharp
app.Use(new LoggingMiddleware());
app.Use(new MetricsMiddleware());
```

The pipeline flows like this:

```
LoggingMiddleware.OnTurnAsync →
  MetricsMiddleware.OnTurnAsync →
    Handler (from app.On())
```

For more examples, see the [Middleware guide](../middleware).

---

## Error handling

If an activity handler throws an exception, it is wrapped in a `BotHandlerException` that carries the original exception and the triggering `CoreActivity`:

```csharp
using Botas;

try
{
    // processAsync is called internally by the framework
}
catch (BotHandlerException ex)
{
    Console.WriteLine($"Handler for '{ex.Activity.Type}' failed: {ex.InnerException?.Message}");
}
```

`BotHandlerException` carries:
- `InnerException` — the original exception
- `Activity` — the `CoreActivity` that triggered the error

If no `app.On()` handlers are registered, the bot silently acknowledges every request with an empty `200 OK` response.

---

## CoreActivity schema

`CoreActivity` uses `System.Text.Json` with `[JsonExtensionData]` to preserve unknown JSON properties:

| Property | Type | Description |
|---|---|---|
| `Type` | `string` | Activity type (`"message"`, `"typing"`, etc.) |
| `ServiceUrl` | `string` | The channel's service endpoint |
| `From` | `ChannelAccount?` | Sender |
| `Recipient` | `ChannelAccount?` | Recipient |
| `Conversation` | `Conversation?` | Conversation reference |
| `Text` | `string?` | Message text |
| `Entities` | `JsonArray?` | Attached entities |
| `Attachments` | `List<Attachment>?` | Attached files/cards |

Any additional JSON properties are preserved in the `[JsonExtensionData]` dictionary and round-trip safely through serialization.

---

## ConversationClient

For advanced scenarios, `ConversationClient` exposes the Conversations REST API:

| Method | Description |
|--------|-------------|
| `SendActivityAsync` | Send an activity to a conversation |

The `TurnContext.SendAsync()` method is the recommended way to send replies — it uses `ConversationClient` under the hood with proper addressing.

---

## Teams features

Use `TeamsActivityBuilder` to send mentions, adaptive cards, and suggested actions. See the [Teams Features guide](../teams-features) for full examples.

---

## API Reference

Full API documentation is generated with DocFX from XML doc comments:

📘 [.NET API Reference](/api/generated/dotnet/api/Botas.html)

```csharp
// Echo with a mention
var sender = ctx.Activity.From!;
var reply = new TeamsActivityBuilder()
    .WithConversationReference(ctx.Activity)
    .WithText($"<at>{sender.Name}</at> said: {ctx.Activity.Text}")
    .AddMention(sender)
    .Build();
await ctx.SendAsync(reply, ct);
```

Use `TeamsActivity.FromActivity()` to access Teams-specific metadata:

```csharp
var teamsActivity = TeamsActivity.FromActivity(ctx.Activity);
var tenantId = teamsActivity.ChannelData?.Tenant?.Id;
```

---

## Configuration

The bot reads Azure AD credentials from the `AzureAd` configuration section. In development you typically use **user secrets**, environment variables, or the `.env` bridge script; in production use Azure App Configuration or Key Vault.

### Option 1 — Shared `.env` file (recommended for development)

If you keep a `.env` file at the repository root (shared with Node.js and Python samples), use the helper script to generate a `launchSettings.json`:

```bash
node dotnet/env-to-launch-settings.mjs EchoBot
```

This reads `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID` from `.env` and maps them to the ASP.NET Core equivalents (`AzureAd:ClientId`, `AzureAd:ClientCredentials:0:*`, etc.). The generated file lives at `samples/EchoBot/Properties/launchSettings.json` and is already gitignored.

To generate for all samples at once, omit the sample name:

```bash
node dotnet/env-to-launch-settings.mjs
```

### Option 2 — `appsettings.json`

Minimal `appsettings.json` (add the `$schema` for IntelliSense in VS / VS Code):

```json
{
  "$schema": "https://json.schemastore.org/appsettings.json",
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com/",
    "ClientId": "<your-bot-app-id>",
    "TenantId": "<your-tenant-id>",
    "ClientCredentials": [
      {
        "SourceType": "ClientSecret",
        "ClientSecret": "<your-client-secret>"
      }
    ]
  }
}
```

> **Note:** Microsoft.Identity.Web v3+ requires the `ClientCredentials` array format. The flat `"ClientSecret"` property is no longer supported.

### Option 3 — Environment variables

Use the ASP.NET Core double-underscore convention:

```bash
export AzureAd__ClientId="<your-bot-app-id>"
export AzureAd__TenantId="<your-tenant-id>"
export AzureAd__ClientCredentials__0__SourceType="ClientSecret"
export AzureAd__ClientCredentials__0__ClientSecret="<your-client-secret>"
```

For setup details on Azure Bot registration and credentials, see the [Setup Guide](../setup) and [Authentication](../authentication).

---

## Key types reference

| Type | Description |
|------|-------------|
| `BotApplication` | Main bot class — owns the handler, middleware pipeline, and send methods |
| `CoreActivity` | Deserialized Bot Service activity; preserves unknown JSON properties via `[JsonExtensionData]` |
| `ChannelAccount` | Represents a user or bot identity (`Id`, `Name`, `AadObjectId`, `Role`) |
| `Conversation` | Conversation identifier (`Id`), also preserves extension data |
| `ConversationClient` | Sends outbound activities over the authenticated HTTP client |
| `ITurnMiddleWare` | Middleware interface — implement `OnTurnAsync` |
| `BotHandlerException` | Wraps handler exceptions with the triggering activity |
| `TeamsActivity` | Teams-specific activity — `ChannelData`, `Timestamp`, `Locale`, `SuggestedActions`, and `FromActivity()` factory |
| `TeamsActivityBuilder` | Fluent builder for Teams replies — `AddMention()`, `AddAdaptiveCardAttachment()`, `WithSuggestedActions()` |
| `TeamsChannelData` | Typed Teams channel metadata — `Tenant`, `Channel`, `Team`, `Meeting`, `Notification` |
| `SuggestedActions` | Quick-reply buttons — contains `CardAction[]` |
| `Entity` | Activity entity (e.g. mention) with extension data |
| `Attachment` | File or card attachment with `ContentType`, `Content`, and extension data |
