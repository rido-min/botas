# Botas — Bot ApplicationS (.NET)

A lightweight .NET library for building [Microsoft Bot Framework](https://learn.microsoft.com/azure/bot-service/) bots with ASP.NET Core.

## What it does

- Validates inbound JWT tokens from the Bot Framework Service
- Deserializes activities and dispatches them to a registered handler
- Runs a configurable middleware pipeline before each handler
- Authenticates outbound HTTP calls using OAuth2 client credentials
- Preserves unknown JSON properties so custom channel data round-trips safely

## Installation

```bash
dotnet add package Botas
```

## Quick start

```csharp
var builder = WebApplication.CreateSlimBuilder(args);
builder.Services.AddBotApplication<BotApplication>();
var webApp = builder.Build();
var botApp = webApp.UseBotApplication<BotApplication>();

botApp.OnActivity = async (activity, ct) => {
    if (activity.Type == "message")
        await botApp.SendActivityAsync(activity.CreateReply($"You said: {activity.Text}"), ct);
};

webApp.Run();
```

## Configuration

Set the following environment variables (or use `appsettings.json`):

| Variable | Description |
|---|---|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID |
| `PORT` | HTTP listen port (default: `3978`) |

## Documentation

- [Full feature specification](https://github.com/rido-min/botas/blob/main/specs/README.md)
- [Architecture overview](https://github.com/rido-min/botas/blob/main/specs/Architecture.md)
- [Infrastructure setup](https://github.com/rido-min/botas/blob/main/specs/Setup.md)
- [Repository root](https://github.com/rido-min/botas)
