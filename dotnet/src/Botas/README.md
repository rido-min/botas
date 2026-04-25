<img src="https://raw.githubusercontent.com/rido-min/botas/main/art/icon-256.png" alt="botas logo" width="96" align="right"/>

# Botas The Bot App SDK

A lightweight library for building [Microsoft Teams](https://learn.microsoft.com/en-us/microsoftteams/platform/) bots — this is the **.NET** package.

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

## API

### `BotApp`

| Method | Description |
|---|---|
| `On(type, handler)` | Register a handler for an activity type |
| `OnInvoke(name, handler)` | Register a handler for an invoke activity by name |
| `Use(middleware)` | Add a middleware to the turn pipeline (runs in registration order) |
| `Run()` | Start the ASP.NET Core server |

## Configure the App Credentials

You can configure the bot app credentials using the `appSettings.json` or overrid with env vars from `launchSettings.json`:

#### appSettings.json

```json
// copy to outdir
{
  "$schema": "https://json.schemastore.org/appsettings.json",
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "<your-tenant-id>",
    "ClientId": "<your-bot-app-id>",
    "ClientCredentials": [
      {
        "SourceType": "ClientSecret",
        "ClientSecret": "<your-client-secret>"
      }
    ]
  }
}
```

#### launchSettings.json

```json
{
  "$schema": "https://json.schemastore.org/launchsettings.json",
  "profiles": {
    "local": {
      "commandName": "Project",
      "launchBrowser": false,
      "applicationUrl": "http://localhost:3978",
      "environmentVariables": {
        "ASPNETCORE_ENVIRONMENT": "Development",
        "AzureAd__Instance": "https://login.microsoftonline.com/",
        "AzureAd__TenantId": "<your-tenant-id>",
        "AzureAd__ClientId": "<your-bot-app-id>",
        "AzureAd__ClientCredentials__0__SourceType": "",
        "AzureAd__ClientCredentials__0__ClientSecret": "<your-client-secret>",
      }
    }
  }
 }
```

#### env vars

```dotenv
AzureAd__Instance=https://login.microsoftonline.com/
AzureAd__ClientId="<your-bot-app-id>"
AzureAd__TenantId="<your-tenant-id>"
AzureAd__ClientCredentials__0__SourceType="ClientSecret"
AzureAd__ClientCredentials__0__ClientSecret="<your-client-secret>"
```


> 💡 **Tip:** You can configure your app with any of the credentials supported by MSAL [see calling Downstream APIs docs](https://github.com/AzureAD/microsoft-identity-web/wiki/web-apis).

## Documentation

- [Full documentation site](https://rido-min.github.io/botas/)
- [Full feature specification](https://github.com/rido-min/botas/blob/main/specs/README.md)
- [Architecture overview](https://github.com/rido-min/botas/blob/main/specs/architecture.md)
- [Infrastructure setup](https://github.com/rido-min/botas/blob/main/specs/setup.md)

## License

MIT
