<img src="https://raw.githubusercontent.com/rido-min/botas/main/art/icon-256.png" alt="botas logo" width="96" align="right"/>

# botas

A lightweight, multi-language library for building [Microsoft Teams](https://learn.microsoft.com/en-us/microsoftteams/platform/) bots — this is the **core** Python package.

> For zero-boilerplate FastAPI hosting, see [`botas-fastapi`](https://pypi.org/project/botas-fastapi/).

## Installation

```bash
pip install botas
```

## Quick start (with FastAPI)

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

Or use the higher-level [`botas-fastapi`](https://pypi.org/project/botas-fastapi/) wrapper for a simpler setup:

```python
from botas_fastapi import BotApp

app = BotApp()

@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")

app.start()
```

## API

### `BotApplication`

The core bot class — web-framework-agnostic.

| Method | Description |
|---|---|
| `on(type, handler)` | Register a handler for an activity type (also works as a `@decorator`) |
| `on_invoke(name, handler)` | Register a handler for an invoke activity by name (also works as a `@decorator`) |
| `use(middleware)` | Add a middleware to the turn pipeline (runs in registration order) |
| `process_body(body)` | Process a raw JSON body string |

### Authentication options

`BotApplicationOptions` fields (also resolved from environment variables):

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
