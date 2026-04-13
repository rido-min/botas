# botas-fastapi

FastAPI integration for [botas](../botas/README.md) — zero-boilerplate Bot Framework bot hosting.

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

## Configuration

Set the following environment variables:

| Variable        | Description                      |
|-----------------|----------------------------------|
| `CLIENT_ID`     | Azure Bot app (client) ID        |
| `CLIENT_SECRET` | Azure Bot client secret          |
| `TENANT_ID`     | Azure AD tenant ID               |
| `PORT`          | Port to listen on (default 3978) |
