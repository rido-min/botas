<img src="https://raw.githubusercontent.com/rido-min/botas/main/art/icon-256.png" alt="botas logo" width="96" align="right"/>

# botas-fastapi

A lightweight, multi-language library for building [Microsoft Teams](https://learn.microsoft.com/en-us/microsoftteams/platform/) bots — this is the **FastAPI integration** package.

> Wraps [`botas`](https://pypi.org/project/botas/) with a FastAPI server for zero-boilerplate bot hosting.

## Installation

```bash
pip install botas-fastapi
```

## Quick start

```python
from botas_fastapi import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

## Manual FastAPI wiring

For full control over routes, middleware, and server lifecycle:

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

## API

### `BotApp`

High-level wrapper that composes a `BotApplication` with a FastAPI + Uvicorn server.

| Method | Description |
|---|---|
| `on(type, handler)` | Register a handler for an activity type (also works as a `@decorator`) |
| `on_invoke(name, handler)` | Register a handler for an invoke activity by name (also works as a `@decorator`) |
| `use(middleware)` | Add a middleware to the turn pipeline |
| `start()` | Start the FastAPI/Uvicorn server |

### Options

`BotApp` accepts `BotApplicationOptions` plus these additional keyword arguments:

| Option | Default | Description |
|---|---|---|
| `port` | `3978` (or `PORT` env) | HTTP listen port |
| `path` | `/api/messages` | Endpoint path for incoming activities |
| `auth` | Auto (enabled when `client_id` is set) | Enable/disable JWT auth middleware |

### Authentication options

Inherited from `BotApplicationOptions` (also resolved from environment variables):

| Option | Env variable | Description |
|---|---|---|
| `client_id` | `CLIENT_ID` | Azure AD application (bot) ID |
| `client_secret` | `CLIENT_SECRET` | Azure AD client secret |
| `tenant_id` | `TENANT_ID` | Azure AD tenant ID (default: `common`) |
| `managed_identity_client_id` | `MANAGED_IDENTITY_CLIENT_ID` | Managed identity client ID |
| `token_factory` | — | Custom async token factory `(scope, tenant_id) -> str` |

## Documentation

- [Full documentation site](https://rido-min.github.io/botas/)
- [Full feature specification](https://github.com/rido-min/botas/blob/main/specs/README.md)
- [Architecture overview](https://github.com/rido-min/botas/blob/main/specs/architecture.md)
- [Infrastructure setup](https://github.com/rido-min/botas/blob/main/specs/setup.md)

## License

MIT
