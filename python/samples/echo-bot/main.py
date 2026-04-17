# Echo Bot — minimal BotApp sample
# Run: python main.py

from botas import InvokeResponse
from botas_fastapi import BotApp

app = BotApp()


@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")


@app.on_invoke("test/echo")
async def on_invoke_echo(ctx):
    return InvokeResponse(status=200, body=ctx.activity.value)


app.start()
