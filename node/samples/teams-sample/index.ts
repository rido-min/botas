// TeamsSample — demonstrates TeamsActivity features:
//   • Mentions — echo back with an @mention of the sender
//   • Suggested Actions — offer quick-reply buttons
//   • Adaptive Cards — send a rich card with the user's message

import { BotApp } from 'botas-express'
import { TeamsActivityBuilder } from 'botas'

const app = new BotApp()

app.on('message', async (ctx) => {
  const text = (ctx.activity.text ?? '').trim()

  if (text.toLowerCase() === 'cards') {
    // Send an Adaptive Card
    const cardJson = JSON.stringify({
      type: 'AdaptiveCard',
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      version: '1.5',
      body: [
        {
          type: 'TextBlock',
          text: 'Hello from TeamsSample!',
          size: 'Large',
          weight: 'Bolder'
        },
        {
          type: 'TextBlock',
          text: 'This is an Adaptive Card sent by the bot.',
          wrap: true
        }
      ]
    })

    const reply = new TeamsActivityBuilder()
      .withConversationReference(ctx.activity)
      .withAdaptiveCardAttachment(cardJson)
      .build()

    await ctx.send(reply)
  } else if (text.toLowerCase() === 'actions') {
    // Send Suggested Actions
    const reply = new TeamsActivityBuilder()
      .withConversationReference(ctx.activity)
      .withText('Pick an option:')
      .withSuggestedActions({
        actions: [
          { type: 'imBack', title: '🃏 Cards', value: 'cards' },
          { type: 'imBack', title: '👋 Mention', value: 'mention' },
          { type: 'imBack', title: '⚡ Actions', value: 'actions' }
        ]
      })
      .build()

    await ctx.send(reply)
  } else {
    // Default: echo back with a mention of the sender
    const sender = ctx.activity.from
    const reply = new TeamsActivityBuilder()
      .withConversationReference(ctx.activity)
      .withText(`<at>${sender.name}</at> said: ${text}`)
      .addMention(sender)
      .build()

    await ctx.send(reply)
  }
})

app.start()
