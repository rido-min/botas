# AI Bot — BotApp + Microsoft Agent Framework
# Run: python main.py
# Env: AZURE_AI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT

import os

from botas_fastapi import BotApp
from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity import DefaultAzureCredential

endpoint = os.environ.get("AZURE_AI_ENDPOINT", "")
deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")

credential = DefaultAzureCredential()
client = FoundryChatClient(
    project_endpoint=endpoint,
    model=deployment,
    credential=credential,
)

agent = Agent(
    client=client,
    name="BotasAssistant",
    instructions="You are a helpful assistant. Keep your answers concise.",
)

# Maintain per-conversation sessions
conversation_sessions: dict[str, object] = {}

app = BotApp()


@app.on("message")
async def on_message(ctx):
    conversation_id = ctx.activity.conversation.id
    if conversation_id not in conversation_sessions:
        conversation_sessions[conversation_id] = agent.create_session()
    session = conversation_sessions[conversation_id]

    result = await agent.run(ctx.activity.text or "", session=session)
    await ctx.send(str(result))


app.start()
