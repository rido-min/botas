// Test Bot — feature-rich bot for E2E/Playwright testing
// Run: npx tsx index.ts

import { BotApp } from 'botas-express'
import { BotApplication, TeamsActivityBuilder } from 'botas-core'
import { AdaptiveCardBuilder, TextWeight, toObject } from 'fluent-cards'

const platform = `Node.js ${process.version} ${process.platform} ${process.arch}`

const app = new BotApp()

app.on('message', async (ctx) => {
  const text = (ctx.activity.text ?? '').trim()
  if (text.toLowerCase() === 'card') {
    const card = AdaptiveCardBuilder.create()
      .withVersion('1.5')
      .addTextBlock(tb => tb.withText('Invoke Test Card').withWeight(TextWeight.Bolder))
      .addTextBlock(tb => tb.withText('Click the button to trigger an invoke.'))
      .addAction(a => a.execute().withTitle('Submit').withVerb('test').withData({ source: 'e2e' }))
      .build()

    await ctx.send({
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: toObject(card)
      }]
    })
  } else if (text.toLowerCase() === 'submit') {
    // Action.Submit card — clicking produces a message activity with flat activity.value
    const card = AdaptiveCardBuilder.create()
      .withVersion('1.5')
      .addTextBlock(tb => tb.withText('Action.Submit Test Card').withWeight(TextWeight.Bolder))
      .addTextBlock(tb => tb.withText('Click the button to send a message with value.'))
      .addAction(a => a.submit().withTitle('Send').withData({ source: 'e2e', action: 'submit' }))
      .build()

    await ctx.send({
      type: 'message',
      attachments: [{
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: toObject(card)
      }]
    })
  } else if (text.toLowerCase().startsWith('mention')) {
    const sender = ctx.activity.from
    const displayName = sender?.name ?? sender?.id ?? 'user'
    const reply = new TeamsActivityBuilder()
      .withConversationReference(ctx.activity)
      .withText(`<at>${displayName}</at> said: ${text}`)
      .addMention(sender!)
      .build()
    await ctx.send(reply)
  } else if (ctx.activity.value && !text) {
    // Action.Submit produces a message with activity.value (no text)
    await ctx.send(`Submit received: ${JSON.stringify(ctx.activity.value)}`)
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
