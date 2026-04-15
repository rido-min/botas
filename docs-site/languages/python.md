---
outline: deep
---

# Python

Build Microsoft Teams bots in Python with **botas** — a lightweight, async-first library that works with any ASGI/WSGI framework.

## Prerequisites

- Python **3.11** or later
- An Azure Bot registration ([setup guide](../auth-setup)) with `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID`

---

## Installation

```bash
pip install botas-fastapi
```

This installs the `botas-fastapi` package (which includes `botas` core) along with FastAPI, uvicorn, and all runtime dependencies (httpx, PyJWT, MSAL, Pydantic).

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
3. Wires up `BotApplication.process_body()` to handle incoming activities
4. Starts the server on `int(os.environ.get("PORT", 3978))`

### Handler registration with `@app.on()`

Use `@app.on(type)` to register per-activity-type handlers. The handler receives a `TurnContext` (not a raw `CoreActivity`):

```python
@app.on("message")
async def on_message(ctx):
    # ctx.activity is the incoming activity
    # ctx.send() sends a reply
    await ctx.send(f"You said: {ctx.activity.text}")

@app.on("conversationUpdate")
async def on_conversation_update(ctx):
    # Access extra JSON fields through model_extra
    members_added = (ctx.activity.model_extra or {}).get("membersAdded")
    print("New members:", members_added)
```

If no handler is registered for an incoming activity type, the activity is **silently ignored** — no error is raised.

### Sending replies with `ctx.send()`

`TurnContext.send()` is the simplest way to send a reply:

```python
# Send text
await ctx.send("Hello!")

# Send a full activity (as dict)
await ctx.send({
    "type": "message",
    "text": "Hello!",
})
```

`send(str)` automatically creates a properly-addressed reply with the given text. `send(dict)` sends the activity as-is through the authenticated `BotApplication.send_activity_async()`.

---

## Advanced: Manual framework integration

For advanced scenarios — custom FastAPI middleware, aiohttp, or other frameworks — you can use `BotApplication` directly and wire up the HTTP handling yourself.

---

## BotApplication

`BotApplication` is the central object that manages handlers, middleware, outbound credentials, and the turn pipeline.

### Creating an instance

```python
from botas import BotApplication

# Reads CLIENT_ID, CLIENT_SECRET, TENANT_ID from environment variables
bot = BotApplication()
```

You can also pass credentials explicitly using `BotApplicationOptions`:

```python
from botas import BotApplication, BotApplicationOptions

bot = BotApplication(BotApplicationOptions(
    client_id="your-app-id",
    client_secret="your-secret",
    tenant_id="your-tenant-id",
))
```

### The `appid` property

`bot.appid` returns the configured client ID — handy for health-check endpoints:

```python
@app.get("/")
async def root():
    return {"message": f"Bot {bot.appid} Running"}
```

---

## Registering handlers (BotApplication)

When using `BotApplication` directly (not `BotApp`), handlers are registered by **activity type** using the `@bot.on()` decorator. The decorator receives the type string and the decorated function receives a `TurnContext`.

```python
@bot.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

@bot.on("conversationUpdate")
async def on_conversation_update(activity):
    # Access extra JSON fields through model_extra
    members_added = (activity.model_extra or {}).get("membersAdded")
    print("New members:", members_added)
```

You can also register handlers without the decorator syntax:

```python
async def handle_message(ctx):
    ...

bot.on("message", handle_message)
```

**Key behavior:** If no handler is registered for an activity type, the activity is silently ignored — no error is raised.

---

## Sending replies

### With TurnContext (recommended)

When using handlers that receive `TurnContext`, use `ctx.send()`:

```python
@bot.on("message")
async def on_message(ctx):
    # Send text
    await ctx.send(f"You said: {ctx.activity.text}")

    # Or send a full activity (as dict)
    await ctx.send({
        "type": "message",
        "text": "Custom reply",
    })
```

`ctx.send(str)` automatically creates a properly-addressed reply with the given text. `ctx.send(dict)` sends the activity as-is through `BotApplication.send_activity_async()`.

---

## Authentication

Every incoming request must carry a valid JWT from the Bot Framework. **botas** provides two ways to validate it — pick the one that matches your web framework.

### FastAPI: `bot_auth_dependency()`

The `botas-fastapi` package ships a ready-made FastAPI dependency:

```python
from botas_fastapi import bot_auth_dependency
from fastapi import Depends

@app.post("/api/messages", dependencies=[Depends(bot_auth_dependency())])
async def messages(request: Request):
    body = await request.body()
    await bot.process_body(body.decode())
    return {}
```

`bot_auth_dependency()` reads the `Authorization` header, validates the JWT against the Bot Framework JWKS endpoint, checks the audience against `CLIENT_ID`, and verifies the issuer. On failure it raises an `HTTPException(401)`.

### aiohttp: `validate_bot_token()`

For frameworks without a dependency-injection system, call `validate_bot_token` directly:

```python
from botas.bot_auth import BotAuthError, validate_bot_token

async def messages(request):
    try:
        await validate_bot_token(request.headers.get("Authorization"))
    except BotAuthError as exc:
        raise web.HTTPUnauthorized(reason=str(exc))

    body = await request.text()
    await bot.process_body(body)
    return web.json_response({})
```

Both approaches perform the same validation — JWKS key lookup, RS256 signature check, audience and issuer verification, and automatic key-rollover retry.

---

## Middleware

Middleware lets you intercept every activity before it reaches your handler. Middleware executes in registration order and can short-circuit the pipeline by not calling `next()`.

### Writing middleware

Implement the `TurnMiddleware` protocol:

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

`use()` returns the `BotApplication` instance, so you can chain registrations:

```python
bot.use(LoggingMiddleware()).use(MetricsMiddleware())
```

---

## Error handling

If a handler raises an exception, the library wraps it in a `BotHandlerException`:

```python
from botas import BotHandlerException

try:
    await bot.process_body(body)
except BotHandlerException as exc:
    print(f"Handler for '{exc.activity.type}' failed: {exc.cause}")
```

`BotHandlerException` carries:
- `cause` — the original exception
- `activity` — the `CoreActivity` that triggered the error

---

## CoreActivity schema

`CoreActivity` is a [Pydantic v2](https://docs.pydantic.dev/) model with camelCase JSON aliases and `extra="allow"` for unknown fields:

| Field | Type | Description |
|---|---|---|
| `type` | `str` | Activity type (`"message"`, `"conversationUpdate"`, etc.) |
| `service_url` | `str` | The channel's service endpoint |
| `from_account` | `ChannelAccount \| None` | Sender (mapped from JSON `"from"`) |
| `recipient` | `ChannelAccount \| None` | Recipient |
| `conversation` | `Conversation \| None` | Conversation reference |
| `text` | `str \| None` | Message text |
| `entities` | `list[Entity] \| None` | Attached entities |
| `attachments` | `list[Attachment] \| None` | Attached files/cards |

Any additional JSON properties are preserved in `activity.model_extra`.

::: info
The `from` JSON field is mapped to `from_account` in Python because `from` is a reserved keyword.
:::

---

## Framework integration

### FastAPI (for manual setup)

Full annotated sample — this is the actual code from `python/samples/fastapi/main.py`:

```python
from botas import BotApplication
from botas_fastapi import bot_auth_dependency
from fastapi import Depends, FastAPI, Request

# 1. Create the bot application (credentials come from env vars)
bot = BotApplication()

# 2. Register handlers by activity type (using TurnContext)
@bot.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}. from fastapi")

@bot.on("conversationUpdate")
async def on_conversation_update(ctx):
    print("conversation update", (ctx.activity.model_extra or {}).get("membersAdded"))

# 3. Create the FastAPI app
app = FastAPI()

# 4. Wire up the /api/messages endpoint with JWT auth
@app.post("/api/messages", dependencies=[Depends(bot_auth_dependency())])
async def messages(request: Request):
    body = await request.body()
    await bot.process_body(body.decode())
    return {}

# 5. Optional health and info endpoints
@app.get("/")
async def root():
    return {"message": "Bot " + bot.appid + " Running - send messages to /api/messages"}

@app.get("/health")
async def health():
    return {"status": "ok"}
```

Run it:

```bash
CLIENT_ID=<your-id> CLIENT_SECRET=<your-secret> TENANT_ID=<your-tenant> \
  uvicorn samples.fastapi.main:app --port 3978
```

### aiohttp (alternative manual setup)

Full sample from `python/samples/aiohttp/main.py`:

```python
import os
from aiohttp import web
from botas import BotApplication
from botas.auth.bot_auth import BotAuthError, validate_bot_token

bot = BotApplication()

@bot.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

@bot.on("conversationUpdate")
async def on_conversation_update(ctx):
    print("conversation update", (ctx.activity.model_extra or {}).get("membersAdded"))

# Auth is handled manually — validate the token before processing
async def messages(request: web.Request) -> web.Response:
    try:
        await validate_bot_token(request.headers.get("Authorization"))
    except BotAuthError as exc:
        raise web.HTTPUnauthorized(reason=str(exc))

    body = await request.text()
    await bot.process_body(body)
    return web.json_response({})

async def health(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok"})

app = web.Application()
app.router.add_post("/api/messages", messages)
app.router.add_get("/health", health)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3978))
    web.run_app(app, port=port)
```

Run it:

```bash
CLIENT_ID=<your-id> CLIENT_SECRET=<your-secret> TENANT_ID=<your-tenant> \
  python samples/aiohttp/main.py
```

---

## Teams features

Use `TeamsActivityBuilder` to send mentions, adaptive cards, and suggested actions. See the [Teams Features guide](../teams-features) for full examples.

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

Run the sample:

```bash
cd python/samples/teams-sample && python main.py
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

Or pass them explicitly via `BotApplicationOptions` as shown in [Creating an instance](#creating-an-instance).
