import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BotApplication, BotHandlerException } from './bot-application.js'
import type { CoreActivity } from './core-activity.js'

const baseCoreActivity: CoreActivity = {
  type: 'message',
  serviceUrl: 'http://service.url',
  from: { id: 'user1' },
  recipient: { id: 'bot1' },
  conversation: { id: 'conv1' },
  text: 'hello',
}

function makeBody (overrides: Partial<CoreActivity> = {}): string {
  return JSON.stringify({ ...baseCoreActivity, ...overrides })
}

describe('BotApplication', () => {
  describe('processBody', () => {
    it('dispatches to registered handler by type', async () => {
      const bot = new BotApplication()
      let received: CoreActivity | undefined
      bot.on('message', async (activity) => { received = activity })
      await bot.processBody(makeBody({ type: 'message' }))
      assert.ok(received)
      assert.equal(received.type, 'message')
      assert.equal(received.text, 'hello')
    })

    it('silently ignores unregistered activity types', async () => {
      const bot = new BotApplication()
      let called = false
      bot.on('message', async () => { called = true })
      await bot.processBody(makeBody({ type: 'conversationUpdate' }))
      assert.equal(called, false)
    })

    it('dispatches conversationUpdate to its handler', async () => {
      const bot = new BotApplication()
      let received: CoreActivity | undefined
      bot.on('conversationUpdate', async (activity) => { received = activity })
      await bot.processBody(makeBody({ type: 'conversationUpdate' }))
      assert.ok(received)
      assert.equal(received.type, 'conversationUpdate')
    })

    it('replaces handler when same type registered twice', async () => {
      const bot = new BotApplication()
      const calls: string[] = []
      bot.on('message', async () => { calls.push('first') })
      bot.on('message', async () => { calls.push('second') })
      await bot.processBody(makeBody())
      assert.deepEqual(calls, ['second'])
    })

    it('throws on missing type field', async () => {
      const bot = new BotApplication()
      const body = JSON.stringify({ serviceUrl: 'http://s', conversation: { id: 'c' } })
      await assert.rejects(() => bot.processBody(body), /type/)
    })

    it('throws on missing serviceUrl field', async () => {
      const bot = new BotApplication()
      const body = JSON.stringify({ type: 'message', conversation: { id: 'c' } })
      await assert.rejects(() => bot.processBody(body), /serviceUrl/)
    })

    it('throws on missing conversation.id', async () => {
      const bot = new BotApplication()
      const body = JSON.stringify({ type: 'message', serviceUrl: 'http://s', conversation: {} })
      await assert.rejects(() => bot.processBody(body), /conversation/)
    })
  })

  describe('BotHandlerException', () => {
    it('wraps handler errors with activity reference', async () => {
      const bot = new BotApplication()
      const cause = new Error('handler blew up')
      bot.on('message', async () => { throw cause })
      const err = await bot.processBody(makeBody()).catch((e: unknown) => e)
      assert.ok(err instanceof BotHandlerException)
      assert.equal(err.cause, cause)
      assert.equal(err.activity.type, 'message')
      assert.equal(err.name, 'BotHandlerException')
    })

    it('message includes activity type', async () => {
      const bot = new BotApplication()
      bot.on('message', async () => { throw new Error('oops') })
      const err = await bot.processBody(makeBody()).catch((e: unknown) => e)
      assert.ok(err instanceof BotHandlerException)
      assert.ok(err.message.includes('message'))
    })
  })

  describe('middleware', () => {
    it('runs middleware before handler', async () => {
      const bot = new BotApplication()
      const order: string[] = []
      bot.use({
        async onTurnAsync (_app, _activity, next) {
          order.push('middleware')
          await next()
        },
      })
      bot.on('message', async () => { order.push('handler') })
      await bot.processBody(makeBody())
      assert.deepEqual(order, ['middleware', 'handler'])
    })

    it('runs multiple middleware in registration order', async () => {
      const bot = new BotApplication()
      const order: string[] = []
      bot.use({ async onTurnAsync (_a, _b, next) { order.push('mw1'); await next() } })
      bot.use({ async onTurnAsync (_a, _b, next) { order.push('mw2'); await next() } })
      bot.on('message', async () => { order.push('handler') })
      await bot.processBody(makeBody())
      assert.deepEqual(order, ['mw1', 'mw2', 'handler'])
    })

    it('middleware can short-circuit by not calling next', async () => {
      const bot = new BotApplication()
      let handlerCalled = false
      bot.use({ async onTurnAsync () { /* no next() */ } })
      bot.on('message', async () => { handlerCalled = true })
      await bot.processBody(makeBody())
      assert.equal(handlerCalled, false)
    })
  })
})
