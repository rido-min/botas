// Echo Bot — minimal Deno sample using @botas/core from JSR
// Run: DEBUG=botas:* deno run --allow-net --allow-env main.ts
// deno-lint-ignore-file no-import-prefix no-unversioned-import

import { BotApplication, validateBotToken, BotAuthError } from 'jsr:@botas/core'

const bot = new BotApplication()

bot.on('message', async (ctx) => {
  await ctx.send(`Hellow from deno: ${BotApplication.version}`)
  await ctx.send(`You said: ${ctx.activity.text}`)
})

bot.on('conversationUpdate', async (ctx) => {
  console.log('conversation update', ctx.activity.properties?.['membersAdded'])
  await ctx.send('Welcome to the Echo Bot sample for Deno!')
})

const PORT = Number(Deno.env.get('PORT') ?? '3978')

Deno.serve({ port: PORT }, async (req) => {
  const url = new URL(req.url)

  if (req.method === 'POST' && url.pathname === '/api/messages') {
    const clientId = Deno.env.get('CLIENT_ID')
    console.log(`[${new Date().toISOString()}] POST /api/messages received`)
    console.log(`Client ID configured: ${clientId ? 'yes' : 'no'}`)

    if (clientId) {
      const header = req.headers.get('authorization') ?? undefined
      console.log(`Authorization header: ${header ? `present (${header.substring(0, 30)}...)` : 'missing'}`)

      try {
        console.log(`Validating token against client ID: ${clientId}`)
        await validateBotToken(header, clientId)
        console.log('Token validation: SUCCESS')
      } catch (err) {
        console.error('Token validation FAILED:', err)
        if (err instanceof BotAuthError) {
          console.error(`Auth error message: ${err.message}`)
          return new Response(err.message, { status: 401 })
        }
        throw err
      }
    }

    const body = await req.text()
    await bot.processBody(body)
    return Response.json({})
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    return Response.json({ status: 'ok' })
  }

  return new Response('Not Found', { status: 404 })
})

console.log(`Listening on http://localhost:${PORT}/api/messages`)
