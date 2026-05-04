"""
Sample: botas with Flask
Shows how botas works with any Python web framework.
Run: python main.py
"""

import asyncio
import os

from flask import Flask, jsonify, request

from botas import BotApplication
from botas.bot_auth import BotAuthError, validate_bot_token

# ── Bot ───────────────────────────────────────────────────────────────────────

bot = BotApplication()


@bot.on("message")
async def handle_message(ctx):
    await ctx.send_typing()  # Show typing indicator
    await ctx.send(f"You said: {ctx.activity.text}. from flask")


@bot.on("conversationUpdate")
async def handle_conversation_update(ctx):
    print("conversation update", (ctx.activity.model_extra or {}).get("membersAdded"))


# ── Server ────────────────────────────────────────────────────────────────────

app = Flask(__name__)


@app.route("/api/messages", methods=["POST"])
def messages():
    # Auth validation (if CLIENT_ID is set)
    client_id = os.environ.get("CLIENT_ID")
    if client_id:
        header = request.headers.get("Authorization")
        try:
            asyncio.run(validate_bot_token(header, client_id))
        except BotAuthError as e:
            return jsonify({"error": "Unauthorized", "message": str(e)}), 401

    body = request.get_data(as_text=True)
    asyncio.run(bot.process_body(body))
    return jsonify({})


@app.route("/")
def root():
    return jsonify({"message": f"Bot {bot.appid} Running - send messages to /api/messages"})


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3978))
    print(f"Listening on http://localhost:{port}/api/messages")
    app.run(host="0.0.0.0", port=port)
