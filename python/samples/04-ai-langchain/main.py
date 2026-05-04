# AI Bot — BotApp + LangChain with Azure Foundry
# Run: python main.py
# Env: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT

import os

from botas_fastapi import BotApp
from langchain_azure_ai.chat_models import AzureAIChatCompletionsModel
from langchain_core.messages import AIMessage, HumanMessage

endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
api_key = os.environ.get("AZURE_OPENAI_API_KEY", "")
deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")

model = AzureAIChatCompletionsModel(
    endpoint=endpoint,
    credential=api_key,
    model=deployment,
)

conversation_histories: dict[str, list] = {}

app = BotApp()


@app.on("message")
async def on_message(ctx):
    conversation_id = ctx.activity.conversation.id
    history = conversation_histories.get(conversation_id, [])

    history.append(HumanMessage(content=ctx.activity.text or ""))

    response = await model.ainvoke(history)

    history.append(AIMessage(content=response.content))
    conversation_histories[conversation_id] = history

    await ctx.send(response.content)


app.start()
