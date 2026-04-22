# Python API Reference

**Purpose**: Full Python API signatures and implementation patterns.
**See also**: [Core Specs](../README.md)

---

## BotApp (botas-fastapi)

Zero-boilerplate bot setup with FastAPI.

```python
from botas import BotApp

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
    
    async def send(self, text_or_activity: str | dict) -> ResourceResponse | None:
    
    async def send_typing(self) -> None:
```

### Sending a Message

```python
# String - auto-creates message activity
await ctx.send("Hello!")

# Activity - full control
await ctx.send(my_activity)
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

## Exception Handling

```python
class BotHandlerException(Exception):
    pass
```

---

## HTTP Integration

### FastAPI (botas-fastapi)

```python
from botas import BotApplication
from botas_fastapi import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

### Manual (aiohttp)

```python
from aiohttp import web
from botas import BotApplication

bot = BotApplication()

@bot.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

async def messages_handler(request):
    body = await request.text()
    await bot.process_body(body)
    return web.Response(status=200, text="{}")

app = web.Application()
app.router.add_post('/api/messages', messages_handler)
web.run_app(app, port=3978)
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
| TurnContext.send | `send(str \| dict)` |
| TurnContext.sendTyping | `send_typing()` returns `None` |
| Authentication | `bot_auth_dependency()` / `validate_bot_token()` |
| Activity model | `CoreActivity` Pydantic model with `model_extra` |
| `from` field | `from_account` (`from` is reserved in Python) |
| Prototype pollution | Should strip for defense-in-depth |

---

## Auth Dependency (FastAPI)

```python
from fastapi import FastAPI, Depends
from botas_fastapi import BotApp, bot_auth_dependency

app = FastAPI()
bot = BotApp()

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

@app.post("/api/messages")
async def messages(auth: None = Depends(bot_auth_dependency)):
    await bot.process_body(await request.body())
    return {}
```

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
| `TENANT_ID` | Azure AD tenant ID (or `"common"`) |
| `PORT` | HTTP listen port (default: `3978`) |

---

## References

- [Protocol Spec](../protocol.md)
- [Inbound Auth](../inbound-auth.md)
- [Outbound Auth](../outbound-auth.md)
- [Activity Schema](../activity-schema.md)
