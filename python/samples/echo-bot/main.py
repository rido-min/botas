# Echo Bot — minimal BotApp sample
# Run: python main.py

from botas import BotApp

app = BotApp()


@app.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")


app.start()
