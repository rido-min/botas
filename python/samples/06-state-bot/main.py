# State Bot — TurnState sample with conversation/user/temp scopes
# Run: python main.py

from botas_fastapi import BotApp

from botas.state import FileStorage

app = BotApp()

# Register state middleware with FileStorage
storage = FileStorage("./state-data")
app.bot.use_state(storage)  # Access underlying BotApplication


@app.on("message")
async def on_message(ctx):
    if not ctx.state:
        # State is not configured - shouldn't happen with use_state registered
        return

    text = (ctx.activity.text or "").strip()

    # Special command: reset
    if text.lower() == "reset":
        ctx.state.conversation.delete("turn_count")
        # State will be persisted when handler completes
        return

    # Special command: whoami
    if text.lower() == "whoami":
        user_count = ctx.state.user.get("user_message_count", int) or 0
        # Just read state - no send needed
        return

    # Regular message: increment counters
    turn_count = (ctx.state.conversation.get("turn_count", int) or 0) + 1
    ctx.state.conversation.set("turn_count", turn_count)

    user_count = (ctx.state.user.get("user_message_count", int) or 0) + 1
    ctx.state.user.set("user_message_count", user_count)

    # Use temp scope for the formatted reply (demonstrating all three scopes)
    reply = f"Turn #{turn_count} | Your message #{user_count}: {text}"
    ctx.state.temp.set("reply", reply)

    # State will be persisted automatically when handler completes


app.start()
