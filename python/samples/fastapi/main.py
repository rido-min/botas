from botas import BotApplication, bot_auth_dependency, create_reply_activity
from fastapi import Depends, FastAPI, Request

bot = BotApplication()


@bot.on("message")
async def on_message(activity):
    await bot.send_activity_async(
        activity.service_url,
        activity.conversation.id,
        create_reply_activity(activity, f"You said: {activity.text}. from fastapi"),
    )


@bot.on("conversationUpdate")
async def on_conversation_update(activity):
    print("conversation update", (activity.model_extra or {}).get("membersAdded"))


app = FastAPI()


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
