# Python API Reference

> Full Python API signatures and implementation patterns.

**Status:** Draft

**See also**: [Core Specs](../README.md)

---

## BotApp (botas-fastapi)

Zero-boilerplate bot setup with FastAPI.

```python
from botas_fastapi import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

### Configuration

| Method | Description |
|--------|-------------|
| `BotApp()` | Create app |
| `@app.on(activity_type)` | Register handler (decorator) |
| `app.on(activity_type, handler)` | Register handler (method) |
| `app.start()` | Start server |

---

## BotApplication (Manual API)

Framework-agnostic bot class.

```python
class BotApplication:
    def on(self, activity_type: str, handler: Callable[[TurnContext], Awaitable[None]]) -> "BotApplication"
    
    def on_invoke(self, name: str, handler: Callable[[TurnContext], Awaitable[InvokeResponse]]) -> "BotApplication"
    
    on_activity: Optional[Callable[[TurnContext], Awaitable[None]]]
    
    async def process_body(self, body: str) -> InvokeResponse | None
    
    async def send_activity_async(
        self, service_url: str, conversation_id: str, activity: dict
    ) -> ResourceResponse
    
    def use(self, middleware: TurnMiddleware) -> "BotApplication"
```

### Registration

```python
bot = BotApplication()
bot.on("message", my_handler)
bot.on_activity = catch_all_handler
bot.use(MyMiddleware())
```

---

## TurnContext

Scoped context for the current turn.

```python
class TurnContext:
    activity: CoreActivity
    app: BotApplication
    
    async def send(self, activity_or_text: str | CoreActivity | dict) -> ResourceResponse | None:
    
    async def send_typing(self) -> None:
```

### Sending a Message

```python
# String - auto-creates message activity
await ctx.send("Hello!")

# CoreActivity - full control
await ctx.send(my_activity)

# Dict - raw activity
await ctx.send({"type": "message", "text": "Hello!"})
```

### Sending Typing Indicator

```python
@bot.on("message")
async def on_message(ctx):
    await ctx.send_typing()
    
    await asyncio.sleep(2)
    
    await ctx.send("Done processing!")
```

---

## Activity Types

`Literal` type aliases for type-checker safety when registering handlers.

```python
from botas import ActivityType, TeamsActivityType

# Core types — used by BotApplication for dispatch.
ActivityType = Literal["message", "typing", "invoke"]

# All core types plus Teams/channel-specific types.
TeamsActivityType = Literal[
    "message", "typing", "invoke",
    "event", "conversationUpdate",
    "messageUpdate", "messageDelete", "messageReaction",
    "installationUpdate",
]
```

Handlers accept any `str`, so custom or unknown types work too.

---

## Middleware

### Interface

```python
NextTurn = Callable[[], Awaitable[None]]

class TurnMiddleware(Protocol):
    async def on_turn(
        self,
        context: TurnContext,
        next: NextTurn,
    ) -> None: ...
```

> The legacy `ITurnMiddleware` name is kept as an alias: `ITurnMiddleware = TurnMiddleware`.

### Registration

```python
bot = BotApplication()
bot.use(LoggingMiddleware())
bot.use(ErrorHandlingMiddleware())
```

### Middleware Patterns

#### Logging

```python
import time

class LoggingMiddleware(TurnMiddleware):
    async def on_turn(self, context, next):
        print(f"▶ {context.activity.type}")
        start = time.monotonic()
        await next()
        elapsed = (time.monotonic() - start) * 1000
        print(f"◀ {context.activity.type} ({elapsed:.0f}ms)")
```

#### Error Handling

```python
class ErrorHandlingMiddleware(TurnMiddleware):
    async def on_turn(self, context, next):
        try:
            await next()
        except Exception as ex:
            print(f"Error: {ex}")
            await context.send("Sorry, something went wrong.")
```

#### Short-Circuiting (Filter)

```python
class MessagesOnlyMiddleware(TurnMiddleware):
    async def on_turn(self, context, next):
        if context.activity.type == "message":
            await next()
```

#### Activity Modification

```python
class NormalizeTextMiddleware(TurnMiddleware):
    async def on_turn(self, context, next):
        if context.activity.type == "message" and context.activity.text:
            context.activity.text = context.activity.text.strip().lower()
        await next()
```

#### Remove Bot Mention (Teams)

```python
from botas import RemoveMentionMiddleware
bot.use(RemoveMentionMiddleware())
```

---

## TeamsActivityBuilder

Fluent builder for Teams-specific activities.

```python
reply = TeamsActivityBuilder() \
    .with_conversation_reference(activity) \
    .with_text("<at>User</at> hello") \
    .add_mention(account) \
    .with_channel_data(TeamsChannelData(...)) \
    .with_suggested_actions(SuggestedActions(...)) \
    .add_adaptive_card_attachment(card_json) \
    .build()
```

---

## Invoke Activities

Invoke activities require a specific handler that returns an `InvokeResponse`.

```python
from botas import InvokeResponse

@bot.on_invoke("adaptiveCard/action")
async def handle_card_action(ctx):
    return InvokeResponse(status=200, body={"status": "ok"})
```

For unhandled invoke activities, `BotApplication` automatically returns a 501 (Not Implemented) response.

---

## Exception Handling

```python
class BotHandlerException(Exception):
    """Wraps exceptions raised in handlers or invoke handlers."""
    cause: BaseException
    activity: CoreActivity
```

---

## HTTP Integration

### FastAPI (botas-fastapi)

```python
from botas_fastapi import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

### Manual Integration (any framework)

```python
from botas import BotApplication

bot = BotApplication()

@bot.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

# In your framework's HTTP handler:
async def messages_handler(request):
    body = await request.text()
    invoke_response = await bot.process_body(body)
    if invoke_response is not None:
        return JSONResponse(
            status_code=invoke_response.status,
            content=invoke_response.body if invoke_response.body is not None else {}
        )
    return JSONResponse(content={})
```

---

## Language-Specific Differences

| Concern | Python Behavior |
|---------|-----------------|
| Simple bot API | `BotApp()` (botas-fastapi) |
| Web framework | aiohttp (built-in) or FastAPI (botas-fastapi) |
| Handler registration | `@app.on(type)` decorator or `app.on(type, handler)` |
| CatchAll handler | `on_activity` property |
| HTTP integration | `process_body(body)` |
| SendActivityAsync args | `(service_url, conversation_id, activity)` |
| TurnContext.send | `send(str \| CoreActivity \| dict)` |
| TurnContext.sendTyping | `send_typing()` returns `None` |
| Authentication | `bot_auth_dependency()` / `validate_bot_token()` |
| Activity model | `CoreActivity` Pydantic model with `model_extra` |
| `from` field | `from_account` (`from` is reserved in Python) |
| Prototype pollution | Should strip for defense-in-depth |

---

## Auth Dependency (FastAPI)

`BotApp` handles authentication automatically when a `CLIENT_ID` is set. For manual setup:

```python
from fastapi import FastAPI, Depends, Request
from botas_fastapi import bot_auth_dependency
from botas import BotApplication

bot = BotApplication()

@bot.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

@app.post("/api/messages")
async def messages(
    request: Request,
    auth: None = Depends(bot_auth_dependency)
):
    body = await request.body()
    await bot.process_body(body.decode())
    return {}
```

Token validation happens before the handler runs. If validation fails, a 401 response is returned automatically.

---

## Resource Cleanup

`BotApplication` implements `__aenter__`/`__aexit__` for use with `async with`. Call `aclose()` explicitly if not using the context manager.

```python
async with BotApplication() as bot:
    bot.on("message", handler)
    
# Automatically closed

# Or explicit:
bot = BotApplication()
try:
    # use bot
finally:
    await bot.aclose()
```

---

## Configuration

| Variable | Description |
|----------|-------------|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID (defaults to `"common"`) |
| `MANAGED_IDENTITY_CLIENT_ID` | Client ID for managed identity authentication (alternative to `CLIENT_SECRET`) |
| `ALLOWED_SERVICE_URLS` | Comma-separated list of additional allowed service URL prefixes (security allowlist) |
| `PORT` | HTTP listen port (default: `3978`) |

---

## References

- [Protocol Spec](../protocol.md)
- [Inbound Auth](../inbound-auth.md)
- [Outbound Auth](../outbound-auth.md)
- [Activity Schema](../activity-schema.md)
