# Echo Bot — minimal BotApp sample
# Run: python main.py

import asyncio

from botas_fastapi import BotApp

app = BotApp()


@app.on("message")
async def on_message(ctx):
    # Show typing indicator while processing
    await ctx.send_typing()
    await asyncio.sleep(0.5)  # Simulate work
    await ctx.send(f"You said: {ctx.activity.text}")


app.start()
