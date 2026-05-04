// AI Bot — BotApp + LangChain with Azure OpenAI
// Run: npx tsx index.ts
// Env: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT

// OTel setup must come before any other imports so auto-instrumentation
// patches LangChain before the library is loaded.
import './otel-setup.js'

import { BotApp } from 'botas-express'
import { AzureChatOpenAI } from '@langchain/openai'
import { HumanMessage, AIMessage, type BaseMessage } from '@langchain/core/messages'
import { LangChainOtelCallbackHandler } from './otel-setup.js'

const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o'

const model = new AzureChatOpenAI({
  azureOpenAIApiVersion: process.env.OPENAI_API_VERSION ?? '2024-06-01',
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIApiDeploymentName: deployment,
  callbacks: [new LangChainOtelCallbackHandler()],
})

const conversationHistories = new Map<string, BaseMessage[]>()

const app = new BotApp()

app.on('message', async ctx => {
  const conversationId = ctx.activity.conversation.id
  const history = conversationHistories.get(conversationId) ?? []

  history.push(new HumanMessage(ctx.activity.text ?? ''))

  await ctx.sendTyping()

  const response = await model.invoke(history)

  history.push(new AIMessage(response.content as string))
  conversationHistories.set(conversationId, history)

  await ctx.send(typeof response.content === 'string' ? response.content : JSON.stringify(response.content))
})

app.start()
