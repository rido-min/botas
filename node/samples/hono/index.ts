// Sample: botas with Hono (Node.js adapter)
// Run: npx tsx index.ts

import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { BotApplication, botAuthHono, CoreActivityBuilder } from 'botas'

// ── Bot ───────────────────────────────────────────────────────────────────────

// Credentials are auto-detected from CLIENT_ID / CLIENT_SECRET / TENANT_ID env vars.
const bot = new BotApplication()

bot.on('message', async (activity) => {
  const reply = new CoreActivityBuilder()
    .withConversationReference(activity)
    .withText(`You said: ${activity.text}`)
    .build()
  await bot.sendActivityAsync(activity.serviceUrl, activity.conversation.id, reply)
})

bot.on('conversationUpdate', async (activity) => {
  console.log('conversation update', activity.properties?.['membersAdded'])
})

// ── Server ────────────────────────────────────────────────────────────────────

const app = new Hono()

app.post('/api/messages', botAuthHono(), async (c) => {
  const body = await c.req.text()
  await bot.processBody(body)
  return c.json({})
})

app.get('/health', (c) => c.json({ status: 'ok' }))

const PORT = Number(process.env['PORT'] ?? 3978)
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Listening on http://localhost:${PORT}/api/messages`)
})
