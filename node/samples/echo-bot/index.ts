// Echo Bot — minimal botas-express sample
// Run: npx tsx index.ts

import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.onInvoke('test/echo', async (ctx) => {
  return { status: 200, body: ctx.activity.value }
})

app.start()
