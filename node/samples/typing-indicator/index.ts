// Typing Indicator Sample
import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async (ctx) => {
  const text = (ctx.activity.text ?? '').trim().toLowerCase()

  if (text === 'slow') {
    await ctx.sendTyping()
    await new Promise(resolve => setTimeout(resolve, 3000))
    await ctx.send('Done processing! That took a while.')
  } else {
    await ctx.send('You said: ' + ctx.activity.text)
  }
})

app.on('typing', async (ctx) => {
  console.log('User is typing...')
})

app.start()
