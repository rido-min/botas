// Sample: botas with Koa
// Shows how botas-core works with any Node.js web framework.
// Run: npx tsx index.ts

import Koa from 'koa'
import Router from '@koa/router'
import bodyParser from 'koa-bodyparser'
import { BotApplication, validateBotToken, BotAuthError } from 'botas-core'

// ── Auth middleware for Koa ──────────────────────────────────────────────────

function botAuthKoa(appId?: string): Koa.Middleware {
  const audience = appId ?? process.env['CLIENT_ID']
  if (!audience) {
    throw new Error('botAuthKoa: CLIENT_ID environment variable (or appId parameter) is required when auth is enabled')
  }
  return async (ctx, next) => {
    const header = ctx.get('authorization')
    try {
      await validateBotToken(header, appId)
      await next()
    } catch (err) {
      if (err instanceof BotAuthError) {
        ctx.status = 401
        ctx.body = err.message
        return
      }
      throw err
    }
  }
}

// ── Bot ───────────────────────────────────────────────────────────────────────

const bot = new BotApplication()

bot.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

bot.on('conversationUpdate', async (ctx) => {
  console.log('conversation update', ctx.activity.properties?.['membersAdded'])
})

// ── Server ────────────────────────────────────────────────────────────────────

const app = new Koa()
const router = new Router()

app.use(bodyParser())

router.post('/api/messages', botAuthKoa(), async (ctx) => {
  const body = JSON.stringify(ctx.request.body)
  await bot.processBody(body)
  ctx.body = {}
})

router.get('/health', (ctx) => {
  ctx.body = { status: 'ok' }
})

app.use(router.routes())
app.use(router.allowedMethods())

const PORT = Number(process.env['PORT'] ?? 3978)
app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}/api/messages`)
})
