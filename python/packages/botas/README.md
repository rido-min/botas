<img src="https://raw.githubusercontent.com/rido-min/botas/main/docs/art/icon-256.png" alt="botas logo" width="96" align="right"/>

# botas

Lightweight library for building [Microsoft Bot Framework](https://learn.microsoft.com/azure/bot-service/) bots — Python port.

## Installation

```bash
pip install botas
```

## Quick start

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

## Environment variables

| Variable | Description |
|---|---|
| `CLIENT_ID` | Azure AD application (bot) ID |
| `CLIENT_SECRET` | Azure AD client secret |
| `TENANT_ID` | Azure AD tenant ID (or `common`) |
| `PORT` | HTTP listen port (default: `3978`) |

## Documentation

See the [full documentation](https://github.com/rido-min/botas) for architecture details, middleware, and more.

## License

MIT
