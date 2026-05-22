# Redis State Bot — TurnState sample with RedisStorage
# Run: python main.py

import atexit
import asyncio
import os

from botas.state import RedisStorage
from botas_fastapi import BotApp

app = BotApp()

# Register state middleware with RedisStorage
storage = RedisStorage("redis://localhost:6379")
app.bot.use_state(storage)  # Access underlying BotApplication

_storage_closed = False


def close_storage() -> None:
    """Close Redis connections on shutdown."""
    global _storage_closed
    if _storage_closed:
        return
    _storage_closed = True
    asyncio.run(storage.aclose())


atexit.register(close_storage)

# Check if running in offline mode (no bot credentials configured)
OFFLINE_MODE = not os.environ.get("CLIENT_ID")
if OFFLINE_MODE:
    print("\n⚠️  Running in OFFLINE MODE (no CLIENT_ID set)")
    print("📝 Bot replies will be logged to console instead of sent to Bot Service\n")


@app.on("message")
async def on_message(ctx):
    if not ctx.state:
        # State is not configured - shouldn't happen with use_state registered
        return

    text = (ctx.activity.text or "").strip()

    # Special command: reset
    if text.lower() == "reset":
        ctx.state.conversation.delete("turn_count")
        reply_text = "✅ Conversation state cleared. Counters reset."
        if OFFLINE_MODE:
            print(f"[OFFLINE] Would send: {reply_text}")
        else:
            await ctx.send(reply_text)
        return

    # Special command: whoami
    if text.lower() == "whoami":
        user_count = ctx.state.user.get("user_message_count", int) or 0
        user_id = ctx.activity.from_.id if ctx.activity.from_ else "unknown"
        reply_text = f"👤 User ID: {user_id}\n📊 Your message count: {user_count}"
        if OFFLINE_MODE:
            print(f"[OFFLINE] Would send: {reply_text}")
        else:
            await ctx.send(reply_text)
        return

    # Regular message: increment counters
    turn_count = (ctx.state.conversation.get("turn_count", int) or 0) + 1
    ctx.state.conversation.set("turn_count", turn_count)

    user_count = (ctx.state.user.get("user_message_count", int) or 0) + 1
    ctx.state.user.set("user_message_count", user_count)

    # Use temp scope for the formatted reply (demonstrating all three scopes)
    reply = f"Turn #{turn_count} | Your message #{user_count}: {text}"
    ctx.state.temp.set("reply", reply)

    # Send the reply to the user (or log it in offline mode)
    final_reply = ctx.state.temp.get("reply", str) or reply
    if OFFLINE_MODE:
        print(f"[OFFLINE] Would send: {final_reply}")
    else:
        await ctx.send(final_reply)

    # State will be persisted automatically when handler completes


try:
    app.start()
finally:
    close_storage()
