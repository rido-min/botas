---
outline: deep
---

# Python

📦 [botas on PyPI](https://pypi.org/project/botas/) · 📙 API Reference: [botas](/api/generated/python/botas/index.html) · [botas-fastapi](/api/generated/python/botas-fastapi/index.html)

## Installation

The Python implementation ships as two pip packages, requiring **Python 3.11+**:

| Package &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Description |
|---------|-------------|
| **`botas-fastapi`** | All-in-one package — includes `BotApp`, FastAPI, uvicorn, and all runtime dependencies |
| **`botas`** | Standalone core library — use when integrating with aiohttp or other frameworks |

```bash
pip install botas-fastapi          # recommended — includes botas core
# or, for advanced/non-FastAPI setups:
pip install botas
```

---

## Quick start with BotApp

The simplest way to create a bot in Python is to use `BotApp` from the **`botas-fastapi`** package. It sets up FastAPI, JWT authentication, and the `/api/messages` endpoint in a single call:

```python
from botas_fastapi import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

That's it — **8 lines** to go from zero to a working bot.

### What `BotApp` does

Under the hood, `BotApp`:

1. Creates a FastAPI application with uvicorn
2. Registers `POST /api/messages` with JWT authentication (`bot_auth_dependency()`)
3. Wires up <a href="/api/generated/python/botas/botas.html#BotApplication" target="_blank"><code>BotApplication</code></a>.process_body() to handle incoming activities
4. Starts the server on `int(os.environ.get("PORT", 3978))`

### Handler registration with `@app.on()`

Use `@app.on(type)` to register per-activity-type handlers. The handler receives a <a href="/api/generated/python/botas/botas.html#TurnContext" target="_blank"><code>TurnContext</code></a> (not a raw <a href="/api/generated/python/botas/botas.html#CoreActivity" target="_blank"><code>CoreActivity</code></a>):

```python
@app.on("message")
async def on_message(ctx):
    # ctx.activity is the incoming activity
    # ctx.send() sends a reply
    await ctx.send(f"You said: {ctx.activity.text}")
```

If no handler is registered for an incoming activity type, the activity is **silently ignored** — no error is raised.

### Sending replies with `ctx.send()`

<a href="/api/generated/python/botas/botas.html#TurnContext" target="_blank"><code>TurnContext</code></a>.send() is the simplest way to send a reply:

```python
# Send text
await ctx.send("Hello!")

# Send a full activity (as dict)
await ctx.send({
    "type": "message",
    "text": "Hello!",
})
```

`send(str)` automatically creates a properly-addressed reply with the given text. `send(dict)` sends the activity as-is through the authenticated <a href="/api/generated/python/botas/botas.html#BotApplication" target="_blank"><code>BotApplication</code></a>.send_activity_async().

---

## Advanced: Manual framework integration

For advanced scenarios — custom FastAPI middleware, aiohttp, or other frameworks — you can use <a href="/api/generated/python/botas/botas.html#BotApplication" target="_blank"><code>BotApplication</code></a> directly and wire up the HTTP handling yourself.

### BotApplication

<a href="/api/generated/python/botas/botas.html#BotApplication" target="_blank"><code>BotApplication</code></a> is the central object that manages handlers, middleware, outbound credentials, and the turn pipeline.

### Creating an instance

```python
from botas import BotApplication

# Reads CLIENT_ID, CLIENT_SECRET, TENANT_ID from environment variables
bot = BotApplication()
```

You can also pass credentials explicitly using <a href="/api/generated/python/botas/botas.html#BotApplicationOptions" target="_blank"><code>BotApplicationOptions</code></a>:

```python
from botas import BotApplication, BotApplicationOptions

bot = BotApplication(BotApplicationOptions(
    client_id="your-app-id",
    client_secret="your-secret",
    tenant_id="your-tenant-id",
))
```

### Registering activity handlers (BotApplication)

When using <a href="/api/generated/python/botas/botas.html#BotApplication" target="_blank"><code>BotApplication</code></a> directly (not `BotApp`), handlers are registered by **activity type** using the `@bot.on()` decorator. The decorator receives the type string and the decorated function receives a <a href="/api/generated/python/botas/botas.html#TurnContext" target="_blank"><code>TurnContext</code></a>.

```python
@bot.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")
```

You can also register handlers without the decorator syntax:

```python
async def handle_message(ctx):
    ...

bot.on("message", handle_message)
```

**Key behavior:** If no handler is registered for an activity type, the activity is silently ignored — no error is raised.

---

## FastAPI integration

The `botas-fastapi` package ships a ready-made FastAPI dependency for JWT authentication: `bot_auth_dependency()`.

```python
from botas import BotApplication
from botas_fastapi import bot_auth_dependency
from fastapi import Depends, FastAPI, Request

bot = BotApplication()

@bot.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app = FastAPI()

@app.post("/api/messages", dependencies=[Depends(bot_auth_dependency())])
async def messages(request: Request):
    body = await request.body()
    await bot.process_body(body.decode())
    return {}
```

`bot_auth_dependency()` validates the `Authorization: Bearer <token>` header against the Bot Service JWKS endpoint. If validation fails, it raises `HTTPException(401)`.

`process_body(str)` parses the activity JSON, runs the middleware pipeline and handler.

---

## aiohttp integration

For [aiohttp](https://docs.aiohttp.org/), call `validate_bot_token()` directly to validate the JWT:

```python
from aiohttp import web
from botas import BotApplication
from botas.bot_auth import BotAuthError, validate_bot_token

bot = BotApplication()

@bot.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

async def messages(request: web.Request) -> web.Response:
    try:
        await validate_bot_token(request.headers.get("Authorization"))
    except BotAuthError as exc:
        raise web.HTTPUnauthorized(reason=str(exc))

    body = await request.text()
    await bot.process_body(body)
    return web.json_response({})

app = web.Application()
app.router.add_post("/api/messages", messages)
```

Both `bot_auth_dependency()` and `validate_bot_token()` perform the same validation — JWKS key lookup, RS256 signature check, audience and issuer verification, and automatic key-rollover retry.

---

## Middleware

Middleware lets you intercept every activity before it reaches your handler. Middleware executes in registration order and can short-circuit the pipeline by not calling `next()`.

### Writing middleware

Implement the <a href="/api/generated/python/botas/botas.html#TurnMiddleware" target="_blank"><code>TurnMiddleware</code></a> protocol:

```python
from botas import TurnMiddleware
from botas.turn_context import TurnContext

class LoggingMiddleware(TurnMiddleware):
    async def on_turn(self, context: TurnContext, next) -> None:
        print(f">> Incoming {context.activity.type}")
        await next()  # continue to the next middleware or handler
        print(f"<< Done processing {context.activity.type}")
```

The `next` parameter is an async callable. Call it to pass control to the next middleware (or the handler if this is the last one). Skip calling `next()` to short-circuit the pipeline.

### Registering middleware

```python
bot = BotApplication()
bot.use(LoggingMiddleware())
```

`use()` returns the <a href="/api/generated/python/botas/botas.html#BotApplication" target="_blank"><code>BotApplication</code></a> instance, so you can chain registrations:

```python
bot.use(LoggingMiddleware()).use(MetricsMiddleware())
```

---

## Error handling

If a handler raises an exception, the library wraps it in a <a href="/api/generated/python/botas/botas.html#BotHandlerException" target="_blank"><code>BotHandlerException</code></a>:

```python
from botas import BotHandlerException

try:
    await bot.process_body(body)
except BotHandlerException as exc:
    print(f"Handler for '{exc.activity.type}' failed: {exc.cause}")
```

<a href="/api/generated/python/botas/botas.html#BotHandlerException" target="_blank"><code>BotHandlerException</code></a> carries:
- `cause` — the original exception
- `activity` — the <a href="/api/generated/python/botas/botas.html#CoreActivity" target="_blank"><code>CoreActivity</code></a> that triggered the error

---

## CoreActivity schema

<a href="/api/generated/python/botas/botas.html#CoreActivity" target="_blank"><code>CoreActivity</code></a> is a [Pydantic v2](https://docs.pydantic.dev/) model with camelCase JSON aliases and `extra="allow"` for unknown fields:

| Field | Type | Description |
|---|---|---|
| `type` | `str` | Activity type (`"message"`, `"typing"`, etc.) |
| `service_url` | `str` | The channel's service endpoint |
| `from_account` | <a href="/api/generated/python/botas/botas.html#ChannelAccount" target="_blank"><code>ChannelAccount</code></a> \| None | Sender (mapped from JSON `"from"`) |
| `recipient` | <a href="/api/generated/python/botas/botas.html#ChannelAccount" target="_blank"><code>ChannelAccount</code></a> \| None | Recipient |
| `conversation` | `Conversation \| None` | Conversation reference |
| `text` | `str \| None` | Message text |
| `entities` | list[<a href="/api/generated/python/botas/botas.html#Entity" target="_blank"><code>Entity</code></a>] \| None | Attached entities |
| `attachments` | list[<a href="/api/generated/python/botas/botas.html#Attachment" target="_blank"><code>Attachment</code></a>] \| None | Attached files/cards |

Any additional JSON properties are preserved in `activity.model_extra`.

::: info
The `from` JSON field is mapped to `from_account` in Python because `from` is a reserved keyword.
:::

---

## ConversationClient

For advanced scenarios, `bot.conversation_client` exposes the full Conversations REST API:

| Method | Description |
|--------|-------------|
| `send_activity_async` | Send an activity to a conversation |
| `update_activity_async` | Update an existing activity |
| `delete_activity_async` | Delete an activity |
| `get_conversation_members_async` | List all members |
| `get_conversation_paged_members_async` | List members with pagination |
| `create_conversation_async` | Create a new proactive conversation |

---

## Teams features

Use <a href="/api/generated/python/botas/botas.html#TeamsActivityBuilder" target="_blank"><code>TeamsActivityBuilder</code></a> to send mentions, adaptive cards, and suggested actions. See the [Teams Features guide](../teams-features) for full examples.

```python
from botas import TeamsActivityBuilder

# Echo with a mention
sender = ctx.activity.from_account
reply = (
    TeamsActivityBuilder()
    .with_conversation_reference(ctx.activity)
    .with_text(f"<at>{sender.name}</at> said: {ctx.activity.text}")
    .add_mention(sender)
    .build()
)
await ctx.send(reply)
```

Use `TeamsActivity.from_activity()` to access Teams-specific metadata:

```python
from botas import TeamsActivity

teams_activity = TeamsActivity.from_activity(ctx.activity)
tenant_id = teams_activity.channel_data.tenant.id
```

---

## Configuration

All credentials are read from environment variables by default:

| Variable | Description |
|---|---|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID |
| `PORT` | HTTP listen port (default: `3978`) |

---

## Key types reference

| Type | Description |
|------|-------------|
| <a href="/api/generated/python/botas/botas.html#BotApplication" target="_blank"><code>BotApplication</code></a> | Main bot class — owns handlers, middleware pipeline, and send methods |
| <a href="/api/generated/python/botas/botas.html#CoreActivity" target="_blank"><code>CoreActivity</code></a> | Deserialized Bot Service activity (Pydantic v2); preserves unknown JSON properties in `model_extra` |
| <a href="/api/generated/python/botas/botas.html#ChannelAccount" target="_blank"><code>ChannelAccount</code></a> | Represents a user or bot identity (`id`, `name`, `aad_object_id`, `role`) |
| `Conversation` | Conversation identifier (`id`) |
| <a href="/api/generated/python/botas/botas.html#ConversationClient" target="_blank"><code>ConversationClient</code></a> | Sends outbound activities over the authenticated HTTP client |
| <a href="/api/generated/python/botas/botas.html#TurnMiddleware" target="_blank"><code>TurnMiddleware</code></a> | Middleware protocol — implement `on_turn(context, next)` |
| <a href="/api/generated/python/botas/botas.html#BotHandlerException" target="_blank"><code>BotHandlerException</code></a> | Wraps handler exceptions with the triggering activity |
| <a href="/api/generated/python/botas/botas.html#TeamsActivity" target="_blank"><code>TeamsActivity</code></a> | Teams-specific activity — `channel_data`, `locale`, `suggested_actions`, and `from_activity()` factory |
| <a href="/api/generated/python/botas/botas.html#TeamsActivityBuilder" target="_blank"><code>TeamsActivityBuilder</code></a> | Fluent builder for Teams replies — `add_mention()`, `add_adaptive_card_attachment()`, `with_suggested_actions()` |
| <a href="/api/generated/python/botas/botas.html#TeamsChannelData" target="_blank"><code>TeamsChannelData</code></a> | Typed Teams channel metadata — `tenant`, `channel`, `team`, `meeting`, `notification` |
| <a href="/api/generated/python/botas/botas.html#Entity" target="_blank"><code>Entity</code></a> | Activity entity (e.g. mention) |
| <a href="/api/generated/python/botas/botas.html#Attachment" target="_blank"><code>Attachment</code></a> | File or card attachment with `content_type`, `content` |

---

## API Reference

Full API documentation is generated with pdoc from docstrings:

📙 [botas API Reference](/api/generated/python/botas/index.html)
📙 [botas-fastapi API Reference](/api/generated/python/botas-fastapi/index.html)
