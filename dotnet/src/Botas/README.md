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

## Environment variables

| Variable | Description |
|---|---|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID (or `common`) |
| `PORT` | HTTP listen port (default: `3978`) |

## Documentation

- [Full documentation site](https://rido-min.github.io/botas/)
- [Full feature specification](https://github.com/rido-min/botas/blob/main/specs/README.md)
- [Architecture overview](https://github.com/rido-min/botas/blob/main/specs/Architecture.md)
- [Infrastructure setup](https://github.com/rido-min/botas/blob/main/specs/Setup.md)

## License

MIT
