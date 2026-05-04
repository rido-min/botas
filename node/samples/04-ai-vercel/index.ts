// AI Bot — BotApp + Vercel AI SDK with Azure Foundry
// Run: npx tsx index.ts
// Env: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, AZURE_OPENAI_DEPLOYMENT

import { BotApp } from 'botas-express'
import { azure } from '@ai-sdk/azure'
import { generateText, type ModelMessage } from 'ai'

const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o'

const conversationHistories = new Map<string, ModelMessage[]>()

const app = new BotApp()

app.on('message', async ctx => {
  const conversationId = ctx.activity.conversation.id
  const history = conversationHistories.get(conversationId) ?? []

  history.push({ role: 'user', content: ctx.activity.text ?? '' })

  const { text } = await generateText({
    model: azure(deployment),
    messages: history
  })

  history.push({ role: 'assistant', content: text })
  conversationHistories.set(conversationId, history)

  await ctx.send(text)
})

app.start()
