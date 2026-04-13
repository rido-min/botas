# Echo Bot with RemoveMentionMiddleware
# Strips @bot mentions from incoming text so handlers see clean input.
# Run: python main.py

from botas import RemoveMentionMiddleware
from botas_fastapi import BotApp

app = BotApp()
app.use(RemoveMentionMiddleware())


@app.on("message")
async def on_message(ctx):
    # ctx.activity.text no longer contains <at>BotName</at>
    await ctx.send(f"You said: {ctx.activity.text}")


app.start()
