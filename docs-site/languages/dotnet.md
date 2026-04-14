---
outline: deep
---

# .NET (C#)

## Project setup

The botas library targets **.NET 10**. Add a project reference (or, when published, a NuGet package reference) to your ASP.NET Core web project:

```xml
<!-- Project reference (local development) -->
<ItemGroup>
  <ProjectReference Include="..\..\src\Botas\Botas.csproj" />
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

That's it — **7 lines** to go from zero to a working bot.

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

app.On("conversationUpdate", async (ctx, ct) =>
{
    Console.WriteLine("Members changed");
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

Call this on `IServiceCollection` during host construction. It registers your bot as a singleton, sets up JWT authentication, authorization policies, and the authenticated HTTP clients used to call the Bot Framework REST API.

```csharp
WebApplicationBuilder webAppBuilder = WebApplication.CreateSlimBuilder(args);
webAppBuilder.Services.AddBotApplication<BotApplication>();
```

Under the hood, `AddBotApplication<T>` calls:

- **`AddBotAuthorization`** — configures two JWT bearer schemes (`Bot` and `Agent`) that validate tokens from the Bot Framework and your Azure AD tenant, and wires them into a `DefaultPolicy` authorization policy.
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
        BotApplication botApplication,
        CoreActivity activity,
        NextDelegate next,
        CancellationToken cancellationToken = default)
    {
        Console.WriteLine($">> Incoming: {activity.Type}");

        await next(cancellationToken);  // continue to next middleware / handler

        Console.WriteLine($"<< Done: {activity.Type}");
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

If no `app.On()` handlers are registered, the bot silently acknowledges every request with an empty `200 OK` response.

If the handler throws, the exception is wrapped in a `BotHandlerException` that carries the original exception and the triggering `CoreActivity`.

---

## Full BotApp walkthrough

Here is the complete `Program.cs` from the [EchoBot sample](https://github.com/rido-min/botas/tree/main/dotnet/samples/EchoBot), annotated line by line:

```csharp
using Botas;

// 1. Create a bot application with all boilerplate wired up
var app = BotApp.Create(args);

// 2. Register a handler for incoming messages
app.On("message", async (context, ct) =>
{
    // 3. Send a reply using the turn context
    await context.SendAsync($"Echo: {context.Activity.Text}, from aspnet", ct);
});

// 4. Start the server (default port from ASPNETCORE_URLS or 5000)
app.Run();
```

That's it — **9 lines** to go from zero to a working bot.

---

## Teams features

Use `TeamsActivityBuilder` to send mentions, adaptive cards, and suggested actions. See the [Teams Features guide](../teams-features) for full examples.

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

Run the sample:

```bash
dotnet run --project samples/TeamsSample
```

---

## Configuration

The bot reads Azure AD credentials from the `AzureAd` configuration section. In development you typically use **user secrets** or environment variables; in production use Azure App Configuration or Key Vault.

Minimal `appsettings.json`:

```json
{
  "AzureAd": {
    "ClientId": "<your-bot-app-id>",
    "ClientSecret": "<your-client-secret>",
    "TenantId": "<your-tenant-id>"
  }
}
```

Or use environment variables following the ASP.NET Core convention:

```bash
export AzureAd__ClientId="<your-bot-app-id>"
export AzureAd__ClientSecret="<your-client-secret>"
export AzureAd__TenantId="<your-tenant-id>"
```

For setup details on Azure Bot registration and credentials, see [Authentication & Setup](../auth-setup).

---

## Build and run

```bash
cd dotnet

# Restore dependencies
dotnet restore Botas.slnx

# Build all projects
dotnet build Botas.slnx

# Run tests
dotnet test Botas.slnx

# Run the EchoBot sample
dotnet run --project samples/EchoBot
```

To test locally, expose your machine with a tunnel (e.g., [Dev Tunnels](https://learn.microsoft.com/azure/developer/dev-tunnels/) or ngrok) and point your Azure Bot registration's messaging endpoint to `https://<tunnel>/api/messages`.

---

## Key types reference

| Type | Description |
|------|-------------|
| `BotApplication` | Main bot class — owns the handler, middleware pipeline, and send methods |
| `CoreActivity` | Deserialized Bot Framework activity; preserves unknown JSON properties via `[JsonExtensionData]` |
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
