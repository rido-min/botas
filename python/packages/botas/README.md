# botas — Bot ApplicationS (Python)

A lightweight Python library for building [Microsoft Bot Framework](https://learn.microsoft.com/azure/bot-service/) bots.

## What it does

- Validates inbound JWT tokens from the Bot Framework Service
- Deserializes activities and dispatches them to registered handlers
- Runs a configurable middleware pipeline before each handler
- Authenticates outbound HTTP calls using OAuth2 client credentials
- Preserves unknown JSON properties so custom channel data round-trips safely
<img src="https://raw.githubusercontent.com/rido-min/botas/main/art/icon-256.png" alt="botas logo" width="96" align="right"/>

# botas

Lightweight library for building [Microsoft Bot Framework](https://learn.microsoft.com/azure/bot-service/) bots — Python port.

## Installation

```bash
pip install botas
```

## Quick start (FastAPI)
## Quick start

```python
from fastapi import FastAPI, Depends, Request
from botas import BotApplication, CoreActivityBuilder, bot_auth_dependency

bot = BotApplication()

@bot.on("message")
async def on_message(activity):
    reply = (
        CoreActivityBuilder()
        .with_conversation_reference(activity)
        .with_text(f"You said: {activity.text}")
        .build()
    )
    await bot.send_activity_async(
        activity.service_url,
        activity.conversation.id,
        reply,
    )

app = FastAPI()

@app.post("/api/messages", dependencies=[Depends(bot_auth_dependency())])
async def messages(request: Request):
    await bot.process_body((await request.body()).decode())
    return {}
```

## Configuration

Set the following environment variables:
## Environment variables

| Variable | Description |
|---|---|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID |
| `TENANT_ID` | Azure AD tenant ID (or `common`) |
| `PORT` | HTTP listen port (default: `3978`) |

## Documentation

- [Full feature specification](https://github.com/rido-min/botas/blob/main/specs/README.md)
- [Architecture overview](https://github.com/rido-min/botas/blob/main/specs/Architecture.md)
- [Infrastructure setup](https://github.com/rido-min/botas/blob/main/specs/Setup.md)
- [Repository root](https://github.com/rido-min/botas)
See the [full documentation](https://github.com/rido-min/botas) for architecture details, middleware, and more.

## License

MIT
