<img src="https://raw.githubusercontent.com/rido-min/botas/main/art/icon-256.png" alt="botas logo" width="96" align="right"/>

# Botas

Lightweight library for building [Microsoft Bot Framework](https://learn.microsoft.com/azure/bot-service/) bots — .NET / ASP.NET Core.

## What it does

- Validates inbound JWT tokens from the Bot Framework Service
- Deserializes activities and dispatches them to registered handlers
- Runs a configurable middleware pipeline before each handler
- Authenticates outbound HTTP calls using OAuth2 client credentials
- Preserves unknown JSON properties so custom channel data round-trips safely

## Installation

```bash
dotnet add package Botas
```

## Quick start

```csharp
using Botas;

var app = BotApp.Create(args);

app.On("message", async (ctx, ct) =>
{
    await ctx.SendAsync($"You said: {ctx.Activity.Text}", ct);
});

app.Run();
```

## Configuration

The .NET library reads credentials from the `AzureAd` configuration section. You can provide them via `appsettings.json`, environment variables, or user secrets:

**appsettings.json:**

```json
{
  "AzureAd": {
    "ClientId": "your-application-client-id",
    "TenantId": "your-tenant-id",
    "ClientCredentials": [
      {
        "SourceType": "ClientSecret",
        "ClientSecret": "your-client-secret"
      }
    ]
  }
}
```

**Environment variables** (use the `__` separator for nested config):

| Variable | Description |
|---|---|
| `AzureAd__ClientId` | Azure AD application (bot) ID |
| `AzureAd__TenantId` | Azure AD tenant ID (or `common`) |
| `AzureAd__ClientCredentials__0__SourceType` | `ClientSecret` |
| `AzureAd__ClientCredentials__0__ClientSecret` | Azure AD client secret |

Auth is enabled automatically when `AzureAd:ClientId` is configured. When omitted, the bot runs without authentication (useful for local development with the Bot Framework Emulator).

## Documentation

- [Full documentation site](https://rido-min.github.io/botas/)
- [Full feature specification](https://github.com/rido-min/botas/blob/main/specs/README.md)
- [Architecture overview](https://github.com/rido-min/botas/blob/main/specs/Architecture.md)
- [Infrastructure setup](https://github.com/rido-min/botas/blob/main/specs/Setup.md)

## License

MIT
