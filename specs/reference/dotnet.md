# .NET API Reference

**Purpose**: Full .NET API signatures and implementation patterns.
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
| `BotApp.Create(args)` | Create app with CLI args |
| `app.On(activityType, handler)` | Register handler |
| `app.Run()` | Start HTTP server |

---

## BotApplication (Manual API)

Framework-agnostic bot class for manual HTTP integration.

```csharp
public class BotApplication
{
    public BotApplication On(string activityType, Func<TurnContext, CancellationToken, Task> handler)
    
    public Func<TurnContext, CancellationToken, Task>? OnActivity { get; set; }
    
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

## TurnContext

Scoped context for the current turn.

```csharp
public class TurnContext
{
    public CoreActivity Activity { get; }
    public BotApplication App { get; }
    
    public Task SendAsync(string text, CancellationToken ct)
    public Task SendAsync(CoreActivity activity, CancellationToken ct)
    public Task SendTypingAsync(CancellationToken ct)
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
| Simple bot API | `BotApp.Create()` + `app.On()` |
| Web framework | ASP.NET Core (built-in) |
| Handler registration | `app.On(type, handler)` receiving `TurnContext` |
| CatchAll handler | `OnActivity` property |
| HTTP integration | `ProcessAsync(HttpContext)` |
| SendActivityAsync args | Single `CoreActivity` (carries serviceUrl/conversationId) |
| TurnContext.send | `SendAsync(string)` / `SendAsync(CoreActivity)` |
| TurnContext.sendTyping | `SendTypingAsync()` returns `Task<string>` |
| DI registration | `AddBotApplication<TApp>()` |
| Activity model | `CoreActivity` class with `[JsonExtensionData]` |
| `from` field | `From` (C# allows it) |

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
    public async Task ProcessAsync()
    {
        await _bot.ProcessAsync(Request, Response);
    }
}
```

### With JWT Auth

```csharp
[HttpPost("/api/messages")]
[Authorize(AuthenticationSchemes = "Bearer")]
public async Task ProcessAsync()
{
    await _bot.ProcessAsync(Request, Response);
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
