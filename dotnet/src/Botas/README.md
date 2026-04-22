# Botas The Bot App SDK

Lightweight library for building [Microsoft Bot Framework](https://learn.microsoft.com/azure/bot-service/) bots — .NET / ASP.NET Core.
A lightweight library for building [Microsoft Teams](https://learn.microsoft.com/en-us/microsoftteams/platform/) bots in .NET / ASP.NET Core

## What it does

- Enables a chat experience in Teams, for personal, group, channel or meetings chats.
- Secure inbound messages are dispatched to message handlers
- Implement rich UX in chats using AdaptiveCards, Suggested Actions, Collect feedback and more
- Secure outbound messages using standard Entra Application Tokens

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

```dotenvenv
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
