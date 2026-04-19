// Echo Bot — minimal botas-express sample
// Run: npx tsx index.ts

import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', ctx => ctx.send(`You min said: ${ctx.activity.text}`))



app.start()
