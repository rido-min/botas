// Sample: botas with Express
// Run: npx tsx index.ts

import express from 'express'
import { BotApplication, botAuthExpress, createReplyActivity } from 'botas'

// ── Bot ───────────────────────────────────────────────────────────────────────

// Credentials are auto-detected from CLIENT_ID / CLIENT_SECRET / TENANT_ID env vars.
const bot = new BotApplication()

bot.on('message', async (activity) => {
  await bot.sendActivityAsync(
    activity.serviceUrl,
    activity.conversation.id,
    createReplyActivity(activity, `You said: ${activity.text}`)
  )
})

bot.on('conversationUpdate', async (activity) => {
  console.log('conversation update', activity.properties?.['membersAdded'])
})

// ── Server ────────────────────────────────────────────────────────────────────

const server = express()

server.post('/api/messages', botAuthExpress(), (req, res) => {
  bot.processAsync(req, res)
})

server.get('/health', (_req, res) => res.json({ status: 'ok' }))

const PORT = Number(process.env['PORT'] ?? 3978)
server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}/api/messages`)
})
