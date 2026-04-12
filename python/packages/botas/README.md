# botas — Bot ApplicationS (Python)

A lightweight Python library for building [Microsoft Bot Framework](https://learn.microsoft.com/azure/bot-service/) bots.

## What it does

- Validates inbound JWT tokens from the Bot Framework Service
- Deserializes activities and dispatches them to registered handlers
- Runs a configurable middleware pipeline before each handler
- Authenticates outbound HTTP calls using OAuth2 client credentials
- Preserves unknown JSON properties so custom channel data round-trips safely

## Installation

```bash
pip install botas
```

## Quick start (FastAPI)

```python
from fastapi import FastAPI, Depends, Request
from botas import BotApplication, create_reply_activity, bot_auth_dependency

bot = BotApplication()

@bot.on("message")
async def on_message(activity):
    await bot.send_activity_async(
        activity.service_url,
        activity.conversation.id,
        create_reply_activity(activity, f"You said: {activity.text}")
    )

app = FastAPI()

@app.post("/api/messages", dependencies=[Depends(bot_auth_dependency())])
async def messages(request: Request):
    await bot.process_body((await request.body()).decode())
    return {}
```

## Configuration

Set the following environment variables:

| Variable | Description |
|---|---|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID |
| `PORT` | HTTP listen port (default: `3978`) |

## Documentation

- [Full feature specification](https://github.com/rido-min/botas/blob/main/docs/bot-spec.md)
- [Architecture overview](https://github.com/rido-min/botas/blob/main/docs/Architecture.md)
- [Infrastructure setup](https://github.com/rido-min/botas/blob/main/docs/Setup.md)
- [Repository root](https://github.com/rido-min/botas)
