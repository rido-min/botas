import os

from aiohttp import web
from botas import BotApplication
from botas.auth.bot_auth import BotAuthError, validate_bot_token

bot = BotApplication()


@bot.on("message")
async def on_message(ctx):
    await ctx.send(f"You said: {ctx.activity.text}")


@bot.on("conversationUpdate")
async def on_conversation_update(ctx):
    print("conversation update", ctx.activity.members_added)


async def messages(request: web.Request) -> web.Response:
    try:
        await validate_bot_token(request.headers.get("Authorization"))
    except BotAuthError as exc:
        raise web.HTTPUnauthorized(reason=str(exc))

    body = await request.text()
    await bot.process_body(body)
    return web.json_response({})


async def health(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok"})


app = web.Application()
app.router.add_post("/api/messages", messages)
app.router.add_get("/health", health)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3978))
    web.run_app(app, port=port)
