---
layout: default
title: .NET
parent: Languages
nav_order: 1
---

# .NET (C#)
{: .no_toc }

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

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

## ASP.NET Core integration

Botas provides two extension methods that wire everything into the standard ASP.NET Core host:

### `AddBotApplication<T>` — register services

Call this on `IServiceCollection` during host construction. It registers your bot as a singleton, sets up JWT authentication, authorization policies, and the authenticated HTTP clients used to call the Bot Framework REST API.

```csharp
WebApplicationBuilder webAppBuilder = WebApplication.CreateSlimBuilder(args);
webAppBuilder.Services.AddBotApplication<BotApplication>();
```

Under the hood, `AddBotApplication<T>` calls:

- **`AddBotAuthorization`** — configures two JWT bearer schemes (`Bot` and `Agent`) that validate tokens from the Bot Framework and your Azure AD tenant, and wires them into a `DefaultPolicy` authorization policy.
- **`AddBotApplicationClients`** — registers `ConversationClient` and `UserTokenClient` with pre-configured `HttpClient` instances that automatically attach an outbound OAuth2 bearer token (scope `https://api.botframework.com/.default`).

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

## Handler registration

Botas uses a single **`OnActivity`** callback on `BotApplication`. Every incoming activity — regardless of type — is dispatched to this delegate after the middleware pipeline runs. The delegate receives the deserialized `CoreActivity` and a `CancellationToken`:

```csharp
botApp.OnActivity = async (activity, ct) =>
{
    if (activity.Type == "message")
    {
        // handle messages
    }
    // Unrecognized types are silently ignored
};
```

If `OnActivity` is not set, the bot silently acknowledges every request with an empty `200 OK` response, and no processing happens.

If the handler throws, the exception is wrapped in a `BotHanlderException` that carries the original exception and the triggering `CoreActivity`.

---

## Sending replies

### `CreateReplyActivity`

`CoreActivity` has a convenience method that builds a properly-addressed reply. It copies `ServiceUrl` and `Conversation`, swaps `From` and `Recipient`, and sets the activity type to `"message"`:

```csharp
CoreActivity reply = activity.CreateReplyActivity("Hello back!");
```

### `SendActivityAsync`

Send an outbound activity through the authenticated `ConversationClient`. It POSTs to the Bot Framework REST endpoint at `{serviceUrl}v3/conversations/{conversationId}/activities/`:

```csharp
await botApp.SendActivityAsync(reply, ct);
```

You can also construct a `CoreActivity` manually instead of using `CreateReplyActivity`:

```csharp
await botApp.SendActivityAsync(new CoreActivity()
{
    Type = "message",
    Text = "Hello!",
    Conversation = activity.Conversation,
    ServiceUrl = activity.ServiceUrl
}, ct);
```

> **Note:** `SendActivityAsync` silently skips `trace` and `invoke` activity types — they are not forwarded to the Bot Framework service.

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
botApp.Use(new LoggingMiddleware());
botApp.Use(new MetricsMiddleware());
```

The pipeline flows like this:

```
LoggingMiddleware.OnTurnAsync →
  MetricsMiddleware.OnTurnAsync →
    OnActivity handler
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

For setup details on Azure Bot registration and credentials, see [Setup]({{ site.baseurl }}/docs/Setup).

---

## Full EchoBot walkthrough

Here is the complete `Program.cs` from the [EchoBot sample](https://github.com/nickinbotas/botas/tree/main/dotnet/samples/EchoBot), annotated line by line:

```csharp
using Botas;

// 1. Create a slim web application builder (no Razor, MVC, etc.)
WebApplicationBuilder webAppBuilder = WebApplication.CreateSlimBuilder(args);

// 2. Register the bot — sets up auth, authorization, and HTTP clients
webAppBuilder.Services.AddBotApplication<BotApplication>();

// 3. Build the app
WebApplication webApp = webAppBuilder.Build();

// 4. Map POST /api/messages and enable auth middleware; returns the bot instance
var botApp = webApp.UseBotApplication<BotApplication>();

// 5. Optional health-check endpoint
webApp.MapGet("/", () => Results.Ok($"Bot {botApp.AppId} Running in aspnet"));

// 6. Register the activity handler
botApp.OnActivity = async (activity, ct) =>
{
    // Build and send an echo reply for every incoming activity
    await botApp.SendActivityAsync(
        new CoreActivity()
        {
            Type = "message",
            Text = $"Echo: {activity.Text}, from aspnet",
            Conversation = activity.Conversation,
            ServiceUrl = activity.ServiceUrl
        }, ct);
};

// 7. Start the server (default port from ASPNETCORE_URLS or 5000)
webApp.Run();
```

That's it — **20 lines** to go from zero to a working bot.

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
| `UserTokenClient` | OAuth user-token operations (SSO, sign-out, token exchange) |
| `ITurnMiddleWare` | Middleware interface — implement `OnTurnAsync` |
| `BotHanlderException` | Wraps handler exceptions with the triggering activity |
