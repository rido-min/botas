# .NET API Reference

> Full .NET API signatures and implementation patterns.

**Status:** Draft

**See also**: [Core Specs](../README.md)

---

## BotApp (Simplified API)

Zero-boilerplate bot setup.

```csharp
var app = BotApp.Create(args);

app.On("message", async (ctx, ct) =>
{
    await ctx.SendAsync($"You said: {ctx.Activity.Text}", ct);
});

app.Run();
```

### Configuration

| Method | Description |
|--------|-------------|
| `BotApp.Create(args, routePath?)` | Create app with CLI args and optional custom route path (default: `"api/messages"`) |
| `app.On(activityType, handler)` | Register handler for activity type |
| `app.OnInvoke(name, handler)` | Register handler for invoke activity by name |
| `app.Run()` | Start HTTP server |

---

## BotApplication (Manual API)

Framework-agnostic bot class for manual HTTP integration.

```csharp
public class BotApplication
{
    public string? AppId { get; }
    
    public static string Version { get; }
    
    public Func<TurnContext, CancellationToken, Task>? OnActivity { get; set; }
    
    public BotApplication On(string activityType, Func<TurnContext, CancellationToken, Task> handler)
    
    public BotApplication OnInvoke(string name, Func<TurnContext, CancellationToken, Task<InvokeResponse>> handler)
    
    public Task<CoreActivity> ProcessAsync(HttpContext httpContext, CancellationToken ct = default)
    
    public Task<string> SendActivityAsync(CoreActivity activity, CancellationToken ct = default)
    
    public ITurnMiddleWare Use(ITurnMiddleWare middleware)
}
```

### Registration

```csharp
var bot = new BotApplication();
bot.On("message", MyHandler);
bot.OnActivity = CatchAllHandler;
bot.Use(new MyMiddleware());
```

---

## InvokeResponse

Response object returned by invoke activity handlers.

```csharp
public class InvokeResponse
{
    public int Status { get; set; }
    public object? Body { get; set; }
}
```

The `Status` is written as the HTTP status code; `Body` is serialized as JSON.

Example invoke handler:

```csharp
app.OnInvoke("composeExtension/query", async (ctx, ct) =>
{
    return new InvokeResponse 
    { 
        Status = 200, 
        Body = new { results = new[] { /* ... */ } } 
    };
});
```

---

## TurnContext

Scoped context for the current turn.

```csharp
public class TurnContext
{
    public CoreActivity Activity { get; }
    public BotApplication App { get; }
    
    public Task<string> SendAsync(string text, CancellationToken ct)
    public Task<string> SendAsync(CoreActivity activity, CancellationToken ct)
    public Task<string> SendTypingAsync(CancellationToken ct)
}
```

### Sending a Message

```csharp
// String - auto-creates message activity
await ctx.SendAsync("Hello!", ct);

// Activity - full control
await ctx.SendAsync(myActivity, ct);
```

### Sending Typing Indicator

```csharp
app.On("message", async (ctx, ct) =>
{
    await ctx.SendTypingAsync(ct);
    
    await Task.Delay(2000, ct);
    
    await ctx.SendAsync("Done processing!", ct);
});
```

---

## Activity Types

String constants for compile-time safety when registering handlers.

```csharp
/// Core types — used by BotApplication for dispatch.
public static class ActivityType
{
    public const string Message = "message";
    public const string Typing = "typing";
    public const string Invoke = "invoke";
}

/// All core types plus Teams/channel-specific types.
public static class TeamsActivityType
{
    public const string Message = "message";
    public const string Typing = "typing";
    public const string Invoke = "invoke";
    public const string Event = "event";
    public const string ConversationUpdate = "conversationUpdate";
    public const string MessageUpdate = "messageUpdate";
    public const string MessageDelete = "messageDelete";
    public const string MessageReaction = "messageReaction";
    public const string InstallationUpdate = "installationUpdate";
}
```

Handlers accept any `string`, so custom or unknown types work too.

---

## Middleware

### Interface

```csharp
public delegate Task NextDelegate(CancellationToken cancellationToken);

public interface ITurnMiddleWare
{
    Task OnTurnAsync(
        TurnContext context,
        NextDelegate next,
        CancellationToken cancellationToken = default);
}
```

> Note: Interface is named `ITurnMiddleWare` (capital W) — preserved for compatibility.

### Registration

```csharp
var app = BotApp.Create(args);
app.Use(new LoggingMiddleware());
app.Use(new ErrorHandlingMiddleware());
```

### Middleware Patterns

#### Logging

```csharp
public class LoggingMiddleware : ITurnMiddleWare
{
    public async Task OnTurnAsync(TurnContext context, NextDelegate next, CancellationToken ct = default)
    {
        Console.WriteLine($"▶ {context.Activity.Type}");
        var sw = Stopwatch.StartNew();
        await next(ct);
        Console.WriteLine($"◀ {context.Activity.Type} ({sw.ElapsedMilliseconds}ms)");
    }
}
```

#### Error Handling

```csharp
public class ErrorHandlingMiddleware : ITurnMiddleWare
{
    public async Task OnTurnAsync(TurnContext context, NextDelegate next, CancellationToken ct = default)
    {
        try
        {
            await next(ct);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
            await context.SendAsync("Sorry, something went wrong.", ct);
        }
    }
}
```

#### Short-Circuiting (Filter)

```csharp
public class MessagesOnlyMiddleware : ITurnMiddleWare
{
    public async Task OnTurnAsync(TurnContext context, NextDelegate next, CancellationToken ct = default)
    {
        if (context.Activity.Type == "message")
        {
            await next(ct);
        }
    }
}
```

#### Remove Bot Mention (Teams)

```csharp
app.Use(new RemoveMentionMiddleware());
```

---

## TeamsActivityBuilder

Fluent builder for Teams-specific activities.

```csharp
var reply = new TeamsActivityBuilder()
    .WithConversationReference(activity)
    .WithText("<at>User</at> hello")
    .AddMention(account)
    .WithChannelData(new TeamsChannelData { ... })
    .WithSuggestedActions(new SuggestedActions { ... })
    .AddAdaptiveCardAttachment(cardJson)
    .Build();
```

---

## Exception Handling

```csharp
class BotHandlerException : Exception
{
    public CoreActivity Activity { get; }
}
```

---

## Language-Specific Differences

| Concern | .NET Behavior |
|---------|---------------|
| Simple bot API | `BotApp.Create()` + `app.On()` + `app.OnInvoke()` |
| Web framework | ASP.NET Core (built-in) |
| Handler registration | `app.On(type, handler)` receiving `TurnContext` |
| Invoke handler registration | `app.OnInvoke(name, handler)` returns `InvokeResponse` |
| CatchAll handler | `OnActivity` property |
| HTTP integration | `ProcessAsync(HttpContext)` |
| SendActivityAsync args | Single `CoreActivity` (carries serviceUrl/conversationId) |
| TurnContext.send | `SendAsync(string)` / `SendAsync(CoreActivity)` returning `Task<string>` |
| TurnContext.sendTyping | `SendTypingAsync()` returning `Task<string>` (activity ID) |
| DI registration | `AddBotApplication<TApp>()` |
| Activity model | `CoreActivity` class with `[JsonExtensionData]` |
| `from` field | `From` (C# allows it) |
| Version property | `BotApplication.Version` (static) |
| AppId property | `BotApplication.AppId` (instance property) |
| Route path | `BotApp.Create(args, routePath)` parameter (default: `"api/messages"`) |

---

## HTTP Integration (ASP.NET Core)

### Manual Processing

```csharp
public class BotController : ControllerBase
{
    private readonly BotApplication _bot;
    
    public BotController(BotApplication bot)
    {
        _bot = bot;
    }
    
    [HttpPost("/api/messages")]
    public async Task ProcessAsync(CancellationToken ct = default)
    {
        await _bot.ProcessAsync(HttpContext, ct);
    }
}
```

### With JWT Auth

```csharp
[HttpPost("/api/messages")]
[Authorize(AuthenticationSchemes = "Bearer")]
public async Task ProcessAsync(CancellationToken ct = default)
{
    await _bot.ProcessAsync(HttpContext, ct);
}
```

---

## Resource Cleanup

ASP.NET Core's DI container manages `HttpClient` lifetime via `IHttpClientFactory`. No explicit cleanup needed when using `BotApp.Create()`.

---

## Configuration

| Variable | Description |
|----------|-------------|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID (or `"common"`) |
| `PORT` | HTTP listen port (default: `3978`) |

---

## References

- [Protocol Spec](../protocol.md)
- [Inbound Auth](../inbound-auth.md)
- [Outbound Auth](../outbound-auth.md)
- [Activity Schema](../activity-schema.md)
