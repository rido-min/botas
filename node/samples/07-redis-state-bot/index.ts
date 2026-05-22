// Redis State Bot — demonstrates TurnState with RedisStorage
// Run: npm start

import { BotApp } from 'botas-express'
import { RedisStorage } from 'botas-redis'

const app = new BotApp({ auth: false }) // Disable auth for local testing

const storage = new RedisStorage('redis://localhost:6379')

// Register state middleware with RedisStorage
app.useState(storage)

app.on('message', async ctx => {
  const text = ctx.activity.text?.toLowerCase() || ''

  // Handle "reset" command
  if (text === 'reset') {
    ctx.state?.conversation.clear()
    await ctx.send('Counters reset!')
    return
  }

  // Handle "whoami" command
  if (text === 'whoami') {
    const userCount = ctx.state?.user.get<number>('user_message_count') ?? 0
    const userId = ctx.activity.from?.id ?? 'unknown'
    await ctx.send(`You are ${userId}. You have sent ${userCount} message(s).`)
    return
  }

  // Increment conversation-scoped turn counter
  const turnCount = (ctx.state?.conversation.get<number>('turn_count') ?? 0) + 1
  ctx.state?.conversation.set('turn_count', turnCount)

  // Increment user-scoped message counter
  const userCount = (ctx.state?.user.get<number>('user_message_count') ?? 0) + 1
  ctx.state?.user.set('user_message_count', userCount)

  // Use temp scope for formatted reply (not persisted)
  const reply = `Turn #${turnCount} | Your message #${userCount}: ${ctx.activity.text}`
  ctx.state?.temp.set('reply', reply)

  await ctx.send(ctx.state?.temp.get<string>('reply') ?? reply)
})

process.once('SIGINT', () => {
  storage.close().finally(() => process.exit(0))
})

app.start()
