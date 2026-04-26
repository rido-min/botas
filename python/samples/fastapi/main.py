# Sample: botas with FastAPI (manual setup)
# Shows how to configure FastAPI directly for full control over routes,
# middleware, and server lifecycle. For a simpler approach, see the
# echo-bot sample which uses BotApp.
#
# Run: uvicorn main:app --port 3978

from contextlib import asynccontextmanager

from botas_fastapi import bot_auth_dependency
from fastapi import Depends, FastAPI, Request

from botas import BotApplication

bot = BotApplication()


@bot.on("message")
async def on_message(ctx):
    await ctx.send_typing()  # Show typing indicator
    await ctx.send(f"You said: {ctx.activity.text}. from fastapi")


@bot.on("conversationUpdate")
async def on_conversation_update(ctx):
    print("conversation update", (ctx.activity.model_extra or {}).get("membersAdded"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown - close bot resources
    await bot.aclose()


app = FastAPI(lifespan=lifespan)


@app.post("/api/messages", dependencies=[Depends(bot_auth_dependency())])
async def messages(request: Request):
    body = await request.body()
    await bot.process_body(body.decode())
    return {}


@app.get("/")
async def root():
    return {"message": "Bot " + bot.appid + " Running - send messages to /api/messages"}


@app.get("/health")
async def health():
    return {"status": "ok"}
