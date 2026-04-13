import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BotApplication } from './bot-application.js'
import type { CoreActivity, Entity } from './core-activity.js'
import type { TurnContext } from './turn-context.js'
import { RemoveMentionMiddleware } from './remove-mention-middleware.js'

function mentionEntity (id: string, name: string): Entity {
  return {
    type: 'mention',
    mentioned: { id, name },
    text: `<at>${name}</at>`,
  }
}

const baseCoreActivity: CoreActivity = {
  type: 'message',
  serviceUrl: 'http://service.url',
  from: { id: 'user1' },
  recipient: { id: 'bot1', name: 'TestBot' },
  conversation: { id: 'conv1' },
  text: 'hello',
}

function makeBody (overrides: Partial<CoreActivity> = {}): string {
  return JSON.stringify({ ...baseCoreActivity, ...overrides })
}

describe('RemoveMentionMiddleware', () => {
  it('strips bot mention from activity text', async () => {
    const bot = new BotApplication()
    bot.use(new RemoveMentionMiddleware())

    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({
      text: '<at>TestBot</at> hello world',
      entities: [mentionEntity('bot1', 'TestBot')],
    }))

    assert.equal(receivedText, 'hello world')
  })

  it('leaves text unchanged when no mention entities exist', async () => {
    const bot = new BotApplication()
    bot.use(new RemoveMentionMiddleware())

    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({ text: 'hello world' }))
    assert.equal(receivedText, 'hello world')
  })

  it('leaves text unchanged when mention is for a different user', async () => {
    const bot = new BotApplication()
    bot.use(new RemoveMentionMiddleware())

    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({
      text: '<at>OtherUser</at> hello world',
      entities: [mentionEntity('other-user', 'OtherUser')],
    }))

    assert.equal(receivedText, '<at>OtherUser</at> hello world')
  })

  it('handles mention at the end of text', async () => {
    const bot = new BotApplication()
    bot.use(new RemoveMentionMiddleware())

    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({
      text: 'hello <at>TestBot</at>',
      entities: [mentionEntity('bot1', 'TestBot')],
    }))

    assert.equal(receivedText, 'hello')
  })

  it('handles activity with no text', async () => {
    const bot = new BotApplication()
    bot.use(new RemoveMentionMiddleware())

    let ctx: TurnContext | undefined
    bot.on('message', async (c) => { ctx = c })

    await bot.processBody(makeBody({
      text: undefined,
      entities: [mentionEntity('bot1', 'TestBot')],
    }))

    assert.ok(ctx)
    assert.equal(ctx.activity.text, undefined)
  })

  it('handles activity with no entities array', async () => {
    const bot = new BotApplication()
    bot.use(new RemoveMentionMiddleware())

    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({ text: 'just text', entities: undefined }))
    assert.equal(receivedText, 'just text')
  })

  it('strips only the bot mention, preserves other mentions', async () => {
    const bot = new BotApplication()
    bot.use(new RemoveMentionMiddleware())

    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({
      text: '<at>TestBot</at> cc <at>Alice</at> please review',
      entities: [
        mentionEntity('bot1', 'TestBot'),
        mentionEntity('alice1', 'Alice'),
      ],
    }))

    assert.equal(receivedText, 'cc <at>Alice</at> please review')
  })

  it('calls next() to continue the pipeline', async () => {
    const bot = new BotApplication()
    const order: string[] = []

    bot.use(new RemoveMentionMiddleware())
    bot.use({
      async onTurnAsync (_ctx, next) {
        order.push('after-mention-mw')
        await next()
      },
    })
    bot.on('message', async () => { order.push('handler') })

    await bot.processBody(makeBody({
      text: '<at>TestBot</at> hi',
      entities: [mentionEntity('bot1', 'TestBot')],
    }))

    assert.deepEqual(order, ['after-mention-mw', 'handler'])
  })

  it('ignores non-mention entities', async () => {
    const bot = new BotApplication()
    bot.use(new RemoveMentionMiddleware())

    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({
      text: 'hello world',
      entities: [{ type: 'clientInfo', locale: 'en-US' }],
    }))

    assert.equal(receivedText, 'hello world')
  })

  it('handles mention-only text (result is empty string)', async () => {
    const bot = new BotApplication()
    bot.use(new RemoveMentionMiddleware())

    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({
      text: '<at>TestBot</at>',
      entities: [mentionEntity('bot1', 'TestBot')],
    }))

    assert.equal(receivedText, '')
  })
})
