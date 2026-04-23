import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { BotApplication } from './bot-application.js'
import type { CoreActivity, Entity } from './core-activity.js'
import type { TurnContext } from './turn-context.js'
import { removeMentionMiddleware } from './remove-mention-middleware.js'

// Isolate tests from ambient env vars (CLIENT_ID picked up by resolveBotApplicationOptions)
let savedClientId: string | undefined
let savedClientSecret: string | undefined
let savedTenantId: string | undefined

function mentionEntity (id: string, name: string): Entity {
  return {
    type: 'mention',
    mentioned: { id, name },
    text: `<at>${name}</at>`,
  }
}

const baseCoreActivity: CoreActivity = {
  type: 'message',
  serviceUrl: 'https://smba.trafficmanager.botframework.com/api',
  from: { id: 'user1' },
  recipient: { id: 'bot1', name: 'TestBot' },
  conversation: { id: 'conv1' },
  text: 'hello',
}

function makeBody (overrides: Partial<CoreActivity> = {}): string {
  return JSON.stringify({ ...baseCoreActivity, ...overrides })
}

describe('RemoveMentionMiddleware', () => {
  beforeEach(() => {
    savedClientId = process.env['CLIENT_ID']
    savedClientSecret = process.env['CLIENT_SECRET']
    savedTenantId = process.env['TENANT_ID']
    delete process.env['CLIENT_ID']
    delete process.env['CLIENT_SECRET']
    delete process.env['TENANT_ID']
  })

  afterEach(() => {
    if (savedClientId !== undefined) process.env['CLIENT_ID'] = savedClientId
    else delete process.env['CLIENT_ID']
    if (savedClientSecret !== undefined) process.env['CLIENT_SECRET'] = savedClientSecret
    else delete process.env['CLIENT_SECRET']
    if (savedTenantId !== undefined) process.env['TENANT_ID'] = savedTenantId
    else delete process.env['TENANT_ID']
  })

  it('strips bot mention from activity text', async () => {
    const bot = new BotApplication()
    bot.use(removeMentionMiddleware())

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
    bot.use(removeMentionMiddleware())

    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({ text: 'hello world' }))
    assert.equal(receivedText, 'hello world')
  })

  it('leaves text unchanged when mention is for a different user', async () => {
    const bot = new BotApplication()
    bot.use(removeMentionMiddleware())

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
    bot.use(removeMentionMiddleware())

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
    bot.use(removeMentionMiddleware())

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
    bot.use(removeMentionMiddleware())

    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({ text: 'just text', entities: undefined }))
    assert.equal(receivedText, 'just text')
  })

  it('strips only the bot mention, preserves other mentions', async () => {
    const bot = new BotApplication()
    bot.use(removeMentionMiddleware())

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

    bot.use(removeMentionMiddleware())
    bot.use(async (_ctx, next) => {
      order.push('after-mention-mw')
      await next()
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
    bot.use(removeMentionMiddleware())

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
    bot.use(removeMentionMiddleware())

    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({
      text: '<at>TestBot</at>',
      entities: [mentionEntity('bot1', 'TestBot')],
    }))

    assert.equal(receivedText, '')
  })

  it('matches by AppId (clientId) first, before recipient.id', async () => {
    const bot = new BotApplication({ clientId: 'app-id-123' })
    bot.use(removeMentionMiddleware())

    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({
      text: '<at>TestBot</at> hello from appId',
      recipient: { id: 'channel-assigned-id', name: 'TestBot' },
      entities: [mentionEntity('app-id-123', 'TestBot')],
    }))

    assert.equal(receivedText, 'hello from appId')
  })

  it('falls back to recipient.id when no clientId configured', async () => {
    const bot = new BotApplication()
    bot.use(removeMentionMiddleware())

    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({
      text: '<at>TestBot</at> fallback test',
      entities: [mentionEntity('bot1', 'TestBot')],
    }))

    assert.equal(receivedText, 'fallback test')
  })

  it('uses case-insensitive ID comparison', async () => {
    const bot = new BotApplication()
    bot.use(removeMentionMiddleware())

    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({
      text: '<at>TestBot</at> case test',
      entities: [mentionEntity('BOT1', 'TestBot')],
    }))

    assert.equal(receivedText, 'case test')
  })

  it('uses case-insensitive text replacement', async () => {
    const bot = new BotApplication()
    bot.use(removeMentionMiddleware())

    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({
      text: '<AT>TestBot</AT> mixed case tag',
      entities: [{
        type: 'mention',
        mentioned: { id: 'bot1', name: 'TestBot' },
        text: '<at>TestBot</at>',
      }],
    }))

    assert.equal(receivedText, 'mixed case tag')
  })

  it('strips ALL occurrences of bot mention', async () => {
    const bot = new BotApplication()
    bot.use(removeMentionMiddleware())

    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({
      text: '<at>TestBot</at> do this <at>TestBot</at> please',
      entities: [mentionEntity('bot1', 'TestBot')],
    }))

    assert.equal(receivedText, 'do this  please')
  })

  it('skips regex when entity.text exceeds 200 characters (ReDoS protection)', async () => {
    const bot = new BotApplication()
    bot.use(removeMentionMiddleware())

    const longMention = '<at>' + 'A'.repeat(250) + '</at>'
    let receivedText: string | undefined
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text })

    await bot.processBody(makeBody({
      text: longMention + ' hello',
      entities: [{
        type: 'mention',
        mentioned: { id: 'bot1', name: 'Bot' },
        text: longMention,
      } as Entity],
    }))

    // Text should be unchanged since the long mention entity is skipped
    assert.equal(receivedText, longMention + ' hello')
  })
})
