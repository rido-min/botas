// TeamsSample — demonstrates TeamsActivity features:
//   • conversationUpdate — welcome new team members
//   • messageReaction — acknowledge emoji reactions
//   • typing — log typing indicators
//   • installationUpdate — greet on bot install
//   • Mentions — echo back with an @mention of the sender
//   • Suggested Actions — offer quick-reply buttons
//   • Adaptive Cards — send a rich card with Action.Execute (via fluent-cards)
//   • Invoke handling — respond to adaptiveCard/action

import { BotApp } from 'botas-express'
import { TeamsActivityBuilder } from 'botas-core'
import type { ChannelAccount } from 'botas-core'
import { AdaptiveCardBuilder, TextSize, TextWeight, TextColor, toObject } from 'fluent-cards'

const app = new BotApp()

// --- Activity type handlers (non-message) ---

app.on('conversationUpdate', async (ctx) => {
  const activity = ctx.activity as Record<string, unknown>
  const membersAdded = activity.membersAdded as ChannelAccount[] | undefined
  if (membersAdded) {
    for (const member of membersAdded) {
      if (member.id !== ctx.activity.recipient?.id) {
        const welcome = new TeamsActivityBuilder()
          .withConversationReference(ctx.activity)
          .withText(`Welcome to the team, ${member.name ?? 'friend'}! 👋`)
          .build()
        await ctx.send(welcome)
      }
    }
  }
})

app.on('messageReaction', async (ctx) => {
  const activity = ctx.activity as Record<string, unknown>
  const reactionsAdded = activity.reactionsAdded as Array<{ type: string }> | undefined
  if (reactionsAdded) {
    for (const reaction of reactionsAdded) {
      const reply = new TeamsActivityBuilder()
        .withConversationReference(ctx.activity)
        .withText(`Thanks for the ${reaction.type} reaction! 👍`)
        .build()
      await ctx.send(reply)
    }
  }
})

app.on('typing', async (ctx) => {
  console.log(`User ${ctx.activity.from?.name ?? 'unknown'} is typing...`)
})

app.on('installationUpdate', async (ctx) => {
  const activity = ctx.activity as Record<string, unknown>
  const action = (activity.action as string) ?? 'unknown'
  console.log(`Installation update: ${action}`)
  if (action === 'add') {
    const reply = new TeamsActivityBuilder()
      .withConversationReference(ctx.activity)
      .withText("Thanks for installing me! Type 'cards' to see what I can do. 🚀")
      .build()
    await ctx.send(reply)
  }
})

// --- Invoke handler ---

app.onInvoke('adaptiveCard/action', async (ctx) => {
  const value = ctx.activity.value as any
  const verb = value?.action?.verb ?? 'unknown'
  const data = JSON.stringify(value?.action?.data ?? {})

  const card = AdaptiveCardBuilder.create()
    .withVersion('1.5')
    .addTextBlock(tb => tb
      .withText('✅ Action received!')
      .withSize(TextSize.Large)
      .withWeight(TextWeight.Bolder)
      .withColor(TextColor.Good))
    .addTextBlock(tb => tb
      .withText(`Verb: ${verb}`)
      .withWrap(true))
    .addTextBlock(tb => tb
      .withText(`Data: ${data}`)
      .withWrap(true))
    .addAction(a => a
      .execute()
      .withTitle('Refresh')
      .withVerb('refresh')
      .withData({ action: 'refresh' }))
    .build()

  return {
    status: 200,
    body: {
      statusCode: 200,
      type: 'application/vnd.microsoft.card.adaptive',
      value: toObject(card)
    }
  }
})

// --- Message handler ---

app.on('message', async (ctx) => {
  const text = (ctx.activity.text ?? '').trim()

  if (text.toLowerCase() === 'cards') {
    const card = AdaptiveCardBuilder.create()
      .withVersion('1.5')
      .addTextBlock(tb => tb
        .withText('Hello from TeamsSample!')
        .withSize(TextSize.Large)
        .withWeight(TextWeight.Bolder))
      .addTextBlock(tb => tb
        .withText('Click the button below to trigger an invoke action.')
        .withWrap(true))
      .addInputText(it => it
        .withId('userInput')
        .withPlaceholder('Type something here...'))
      .addAction(a => a
        .execute()
        .withTitle('Submit')
        .withVerb('submitAction')
        .withData({ action: 'submit' }))
      .build()

    const reply = new TeamsActivityBuilder()
      .withConversationReference(ctx.activity)
      .withAdaptiveCardAttachment(toObject(card))
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
