// Sample: botas with Express (manual setup)
// Shows how to configure Express directly for full control over routes,
// middleware, and server lifecycle. For a simpler approach, see the
// echo-bot sample which uses botas-express.
//
// Run: npx tsx index.ts

import express from 'express'
import { BotApplication } from 'botas-core'
import { botAuthExpress } from 'botas-express'

// ── Bot ───────────────────────────────────────────────────────────────────────

// Credentials are auto-detected from CLIENT_ID / CLIENT_SECRET / TENANT_ID env vars.
const bot = new BotApplication()

bot.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}. from express`)
})

bot.on('conversationUpdate', async (ctx) => {
  console.log('conversation update', ctx.activity.properties?.['membersAdded'])
})

// ── Server ────────────────────────────────────────────────────────────────────

const server = express()

// Custom middleware example: request logging
server.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`)
  next()
})

server.post('/api/messages', botAuthExpress(), (req, res) => {
  void bot.processAsync(req, res)
})

server.get('/', (_req, res) => res.send(`Bot ${bot.options.clientId} is running. Send messages to /api/messages`))
server.get('/health', (_req, res) => res.json({ status: 'ok' }))

const PORT = Number(process.env['PORT'] ?? 3978)
server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}/api/messages for bot ${bot.options.clientId}`)
})
