// Sample: botas with Hono (Node.js adapter)
// Run: npx tsx index.ts

import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { BotApplication, validateBotToken, BotAuthError } from 'botas-core'
import type { Context, Next } from 'hono'

// ── Auth middleware for Hono ──────────────────────────────────────────────────

function botAuthHono (appId?: string): (c: Context, next: Next) => Promise<Response | void> {
  const audience = appId ?? process.env['CLIENT_ID']
  if (!audience) {
    throw new Error('botAuthHono: CLIENT_ID environment variable (or appId parameter) is required when auth is enabled')
  }
  return async (c, next) => {
    const header = c.req.header('authorization')
    try {
      await validateBotToken(header, appId)
      return next()
    } catch (err) {
      if (err instanceof BotAuthError) {
        return c.text(err.message, 401)
      }
      throw err
    }
  }
}

// ── Bot ───────────────────────────────────────────────────────────────────────

// Credentials are auto-detected from CLIENT_ID / CLIENT_SECRET / TENANT_ID env vars.
const bot = new BotApplication()

bot.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

bot.on('conversationUpdate', async (ctx) => {
  console.log('conversation update', ctx.activity.properties?.['membersAdded'])
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
