# Advanced Hosting — ASP.NET Core

**Category:** 2 — Advanced Hosting
**Language:** .NET
**Complexity:** Intermediate

## What This Sample Demonstrates

- Manual ASP.NET Core hosting with full control over DI, middleware, routes, and lifecycle
- Using `WebApplication.CreateSlimBuilder` with `AddBotApplication<T>()` and `UseBotApplication<T>()`
- When to use this approach vs the simpler `BotApp.Create()` (see 01-echo-bot)

## Why Use Advanced Hosting?

Use this when you need:
- Custom dependency injection
- Additional ASP.NET Core middleware (auth, CORS, logging)
- Custom route configuration
- Integration with existing ASP.NET Core applications

## Prerequisites

- .NET 9.0+
- No Azure credentials needed for local testing

## Run

```bash
dotnet run
```

## Key Files

- `Program.cs` — Manual ASP.NET Core setup with BotApplication DI integration

## Learn More

- [ASP.NET Core hosting docs](https://learn.microsoft.com/aspnet/core/fundamentals/host/web-host)
