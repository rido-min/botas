// Test Bot — feature-rich bot for E2E/Playwright testing
// Run: npx tsx index.ts

import { BotApp } from 'botas-express'
import { BotApplication } from 'botas-core'

const platform = `Node.js ${process.version} ${process.platform} ${process.arch}`

const app = new BotApp()

app.on('message', async (ctx) => {
  const text = (ctx.activity.text ?? '').trim()
  if (text.toLowerCase() === 'card') {
    await ctx.send({
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          version: '1.5',
          body: [
            { type: 'TextBlock', text: 'Invoke Test Card', weight: 'bolder' },
            { type: 'TextBlock', text: 'Click the button to trigger an invoke.' }
          ],
          actions: [{
            type: 'Action.Execute',
            title: 'Submit',
            verb: 'test',
            data: { source: 'e2e' }
          }]
        }
      }]
    })
  } else {
    await ctx.send(`Echo: ${ctx.activity.text} [botas-node v${BotApplication.version} | ${platform}]`)
  }
})

app.onInvoke('adaptiveCard/action', async (ctx) => {
  return {
    status: 200,
    body: {
      statusCode: 200,
      type: 'application/vnd.microsoft.card.adaptive',
      value: {
        type: 'AdaptiveCard',
        version: '1.5',
        body: [
          { type: 'TextBlock', text: '✅ Invoke received!', weight: 'bolder' }
        ]
      }
    }
  }
})

app.onInvoke('test/echo', async (ctx) => {
  return { status: 200, body: ctx.activity.value }
})

app.start()
