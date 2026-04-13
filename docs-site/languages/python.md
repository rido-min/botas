---
layout: default
title: Python
parent: Languages
nav_order: 3
---

# Python
{: .no_toc }

Build Microsoft Bot Framework bots in Python with **botas** — a lightweight, async-first library that works with any ASGI/WSGI framework.

<details open markdown="block">
  <summary>Table of contents</summary>
  {: .text-delta }
- TOC
{:toc}
</details>

---

## Prerequisites

- Python **3.11** or later
- An Azure Bot registration ([setup guide](../Setup.md)) with `CLIENT_ID`, `CLIENT_SECRET`, and `TENANT_ID`

---

## Installation

Install from the local source (editable mode):

```bash
cd python/packages/botas
pip install -e ".[dev]"
```

This pulls in the runtime dependencies (FastAPI, httpx, PyJWT, MSAL, Pydantic) and the dev extras (pytest, ruff, respx).

> When a published package is available, install with `pip install botas` instead.

---

## Quick start

```python
from botas import BotApplication, bot_auth_dependency, create_reply_activity
from fastapi import Depends, FastAPI, Request

bot = BotApplication()

@bot.on("message")
async def on_message(activity):
    await bot.send_activity_async(
        activity.service_url,
        activity.conversation.id,
        create_reply_activity(activity, f"You said: {activity.text}"),
    )

app = FastAPI()

@app.post("/api/messages", dependencies=[Depends(bot_auth_dependency())])
async def messages(request: Request):
    body = await request.body()
    await bot.process_body(body.decode())
    return {}
```

That's a fully working echo bot. The rest of this guide breaks down each piece.

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

## Registering handlers

Handlers are registered by **activity type** using the `@bot.on()` decorator. The decorator receives the type string and the decorated function receives a `CoreActivity`.

```python
@bot.on("message")
async def on_message(activity):
    # activity is a CoreActivity instance
    print(f"Got message: {activity.text}")

@bot.on("conversationUpdate")
async def on_conversation_update(activity):
    # Access extra JSON fields through model_extra
    members_added = (activity.model_extra or {}).get("membersAdded")
    print("New members:", members_added)
```

You can also register handlers without the decorator syntax:

```python
async def handle_message(activity):
    ...

bot.on("message", handle_message)
```

**Key behavior:** If no handler is registered for an activity type, the activity is silently ignored — no error is raised.

---

## Sending replies

Use `create_reply_activity` to build a correctly-addressed reply, then `send_activity_async` to send it:

```python
from botas import create_reply_activity

@bot.on("message")
async def on_message(activity):
    reply = create_reply_activity(activity, f"Echo: {activity.text}")
    await bot.send_activity_async(
        activity.service_url,
        activity.conversation.id,
        reply,
    )
```

`create_reply_activity(activity, text)` copies `serviceUrl` and `conversation` from the incoming activity, swaps `from` and `recipient`, and sets the reply text. It returns a plain `dict` ready for JSON serialization.

`send_activity_async` authenticates the outbound call with a client-credentials token, then POSTs to the Bot Framework REST API. It returns a `ResourceResponse` with the new activity's `id`.

---

## Authentication

Every incoming request must carry a valid JWT from the Bot Framework. **botas** provides two ways to validate it — pick the one that matches your web framework.

### FastAPI: `bot_auth_dependency()`

The library ships a ready-made FastAPI dependency:

```python
from botas import bot_auth_dependency
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
from botas.auth.bot_auth import BotAuthError, validate_bot_token

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

Implement the `ITurnMiddleware` protocol:

```python
from botas import ITurnMiddleware, BotApplication
from botas.core_activity import CoreActivity

class LoggingMiddleware:
    async def on_turn_async(self, app: BotApplication, activity: CoreActivity, next) -> None:
        print(f">> Incoming {activity.type} from {activity.from_account.id if activity.from_account else 'unknown'}")
        await next()  # continue to the next middleware or handler
        print(f"<< Done processing {activity.type}")
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

> **Note:** The `from` JSON field is mapped to `from_account` in Python because `from` is a reserved keyword.

---

## Framework integration

### FastAPI (recommended)

Full annotated sample — this is the actual code from `python/samples/fastapi/main.py`:

```python
from botas import BotApplication, bot_auth_dependency, create_reply_activity
from fastapi import Depends, FastAPI, Request

# 1. Create the bot application (credentials come from env vars)
bot = BotApplication()

# 2. Register handlers by activity type
@bot.on("message")
async def on_message(activity):
    await bot.send_activity_async(
        activity.service_url,
        activity.conversation.id,
        create_reply_activity(activity, f"You said: {activity.text}. from fastapi"),
    )

@bot.on("conversationUpdate")
async def on_conversation_update(activity):
    print("conversation update", (activity.model_extra or {}).get("membersAdded"))

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

### aiohttp (alternative)

Full sample from `python/samples/aiohttp/main.py`:

```python
import os
from aiohttp import web
from botas import BotApplication, create_reply_activity
from botas.auth.bot_auth import BotAuthError, validate_bot_token

bot = BotApplication()

@bot.on("message")
async def on_message(activity):
    await bot.send_activity_async(
        activity.service_url,
        activity.conversation.id,
        create_reply_activity(activity, f"You said: {activity.text}"),
    )

@bot.on("conversationUpdate")
async def on_conversation_update(activity):
    print("conversation update", activity.members_added)

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

## Configuration

All credentials are read from environment variables by default:

| Variable | Description |
|---|---|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID |
| `PORT` | HTTP listen port (default: `3978`) |

Or pass them explicitly via `BotApplicationOptions` as shown in [Creating an instance](#creating-an-instance).

---

## Build and test

```bash
cd python/packages/botas

# Install in editable mode with dev dependencies
pip install -e ".[dev]"

# Run tests
python -m pytest tests/ -v

# Lint
ruff check .
```

---

## Next steps

- [Architecture overview](../Architecture.md) — understand the turn pipeline and two-auth model
- [Bot spec](../bot-spec.md) — canonical feature specification
- [Azure setup](../Setup.md) — register your bot and get credentials
