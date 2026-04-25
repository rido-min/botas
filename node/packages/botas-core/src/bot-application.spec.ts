import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BotApplication, BotHandlerException, ActivityValidationError } from './bot-application.js'
import type { CoreActivity } from './core-activity.js'
import type { TurnContext } from './turn-context.js'

const baseCoreActivity: CoreActivity = {
  type: 'message',
  serviceUrl: 'https://smba.trafficmanager.botframework.com/api',
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
      let received: TurnContext | undefined
      bot.on('message', async (ctx) => { received = ctx })
      await bot.processBody(makeBody({ type: 'message' }))
      assert.ok(received)
      assert.equal(received.activity.type, 'message')
      assert.equal(received.activity.text, 'hello')
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
      let received: TurnContext | undefined
      bot.on('conversationUpdate', async (ctx) => { received = ctx })
      await bot.processBody(makeBody({ type: 'conversationUpdate' }))
      assert.ok(received)
      assert.equal(received.activity.type, 'conversationUpdate')
    })

    it('replaces handler when same type registered twice', async () => {
      const bot = new BotApplication()
      const calls: string[] = []
      bot.on('message', async () => { calls.push('first') })
      bot.on('message', async () => { calls.push('second') })
      await bot.processBody(makeBody())
      assert.deepEqual(calls, ['second'])
    })

    it('matches handler registered with uppercase type to lowercase activity type', async () => {
      const bot = new BotApplication()
      let received: TurnContext | undefined
      bot.on('Message', async (ctx) => { received = ctx })
      await bot.processBody(makeBody({ type: 'message' }))
      assert.ok(received)
      assert.equal(received.activity.type, 'message')
    })

    it('matches handler registered with lowercase type to mixed-case activity type', async () => {
      const bot = new BotApplication()
      let received: TurnContext | undefined
      bot.on('typing', async (ctx) => { received = ctx })
      await bot.processBody(makeBody({ type: 'Typing' }))
      assert.ok(received)
      assert.equal(received.activity.type, 'Typing')
    })

    it('throws ActivityValidationError on missing type field', async () => {
      const bot = new BotApplication()
      const body = JSON.stringify({ serviceUrl: 'http://s', conversation: { id: 'c' } })
      await assert.rejects(() => bot.processBody(body), (err: unknown) => {
        assert.ok(err instanceof ActivityValidationError)
        assert.match(err.message, /type/)
        return true
      })
    })

    it('throws ActivityValidationError on missing serviceUrl field', async () => {
      const bot = new BotApplication()
      const body = JSON.stringify({ type: 'message', conversation: { id: 'c' } })
      await assert.rejects(() => bot.processBody(body), (err: unknown) => {
        assert.ok(err instanceof ActivityValidationError)
        assert.match(err.message, /serviceUrl/)
        return true
      })
    })

    it('throws ActivityValidationError on missing conversation.id', async () => {
      const bot = new BotApplication()
      const body = JSON.stringify({ type: 'message', serviceUrl: 'http://s', conversation: {} })
      await assert.rejects(() => bot.processBody(body), (err: unknown) => {
        assert.ok(err instanceof ActivityValidationError)
        assert.match(err.message, /conversation/)
        return true
      })
    })

    it('throws ActivityValidationError on empty string type', async () => {
      const bot = new BotApplication()
      const body = JSON.stringify({ type: '', serviceUrl: 'https://smba.trafficmanager.botframework.com/api', conversation: { id: 'c' } })
      await assert.rejects(() => bot.processBody(body), (err: unknown) => {
        assert.ok(err instanceof ActivityValidationError)
        assert.match(err.message, /type/)
        return true
      })
    })

    it('throws ActivityValidationError on empty string serviceUrl', async () => {
      const bot = new BotApplication()
      const body = JSON.stringify({ type: 'message', serviceUrl: '', conversation: { id: 'c' } })
      await assert.rejects(() => bot.processBody(body), (err: unknown) => {
        assert.ok(err instanceof ActivityValidationError)
        assert.match(err.message, /serviceUrl/)
        return true
      })
    })

    it('proceeds normally when type and serviceUrl are present', async () => {
      const bot = new BotApplication()
      let received = false
      bot.on('message', async () => { received = true })
      await bot.processBody(makeBody())
      assert.ok(received)
    })

    it('does not pollute Object prototype via __proto__ key', async () => {
      const bot = new BotApplication()
      const malicious = '{"__proto__":{"isAdmin":true},"type":"message","serviceUrl":"https://smba.trafficmanager.botframework.com/api","conversation":{"id":"c"}}'
      await bot.processBody(malicious)
      assert.equal((({}) as Record<string, unknown>)['isAdmin'], undefined)
    })

    it('does not pollute Object prototype via constructor key', async () => {
      const bot = new BotApplication()
      const malicious = '{"constructor":{"prototype":{"isAdmin":true}},"type":"message","serviceUrl":"https://smba.trafficmanager.botframework.com/api","conversation":{"id":"c"}}'
      await bot.processBody(malicious)
      assert.equal((({}) as Record<string, unknown>)['isAdmin'], undefined)
    })

    it('rejects activity with text exceeding maximum length', async () => {
      const bot = new BotApplication()
      const body = JSON.stringify({
        ...baseCoreActivity,
        text: 'x'.repeat(50_001),
      })
      await assert.rejects(() => bot.processBody(body), /text exceeds maximum length/)
    })

    it('rejects activity with too many entities', async () => {
      const bot = new BotApplication()
      const body = JSON.stringify({
        ...baseCoreActivity,
        entities: Array.from({ length: 101 }, () => ({ type: 'mention' })),
      })
      await assert.rejects(() => bot.processBody(body), /entities array exceeds maximum size/)
    })

    it('rejects activity with too many attachments', async () => {
      const bot = new BotApplication()
      const body = JSON.stringify({
        ...baseCoreActivity,
        attachments: Array.from({ length: 51 }, () => ({ contentType: 'text/plain' })),
      })
      await assert.rejects(() => bot.processBody(body), /attachments array exceeds maximum size/)
    })
  })

  describe('TurnContext', () => {
    it('provides app reference in context', async () => {
      const bot = new BotApplication()
      let ctx: TurnContext | undefined
      bot.on('message', async (c) => { ctx = c })
      await bot.processBody(makeBody())
      assert.ok(ctx)
      assert.equal(ctx.app, bot)
    })

    it('provides send function in context', async () => {
      const bot = new BotApplication()
      let hasSend = false
      bot.on('message', async (ctx) => { hasSend = typeof ctx.send === 'function' })
      await bot.processBody(makeBody())
      assert.equal(hasSend, true)
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

  describe('onActivity (CatchAll)', () => {
    it('receives all activity types', async () => {
      const bot = new BotApplication()
      const received: string[] = []
      bot.onActivity = async (ctx) => { received.push(ctx.activity.type) }
      await bot.processBody(makeBody({ type: 'message' }))
      await bot.processBody(makeBody({ type: 'conversationUpdate' }))
      await bot.processBody(makeBody({ type: 'event' }))
      assert.deepEqual(received, ['message', 'conversationUpdate', 'event'])
    })

    it('bypasses per-type handlers', async () => {
      const bot = new BotApplication()
      let perTypeCalled = false
      bot.on('message', async () => { perTypeCalled = true })
      let catchAllCalled = false
      bot.onActivity = async () => { catchAllCalled = true }
      await bot.processBody(makeBody({ type: 'message' }))
      assert.equal(catchAllCalled, true)
      assert.equal(perTypeCalled, false)
    })

    it('wraps errors in BotHandlerException', async () => {
      const bot = new BotApplication()
      const cause = new Error('catch-all boom')
      bot.onActivity = async () => { throw cause }
      const err = await bot.processBody(makeBody()).catch((e: unknown) => e)
      assert.ok(err instanceof BotHandlerException)
      assert.equal(err.cause, cause)
      assert.equal(err.activity.type, 'message')
    })

    it('falls back to per-type dispatch when not set', async () => {
      const bot = new BotApplication()
      let called = false
      bot.on('message', async () => { called = true })
      // onActivity is undefined by default
      await bot.processBody(makeBody({ type: 'message' }))
      assert.equal(called, true)
    })
  })

  describe('middleware', () => {
    it('runs middleware before handler', async () => {
      const bot = new BotApplication()
      const order: string[] = []
      bot.use(async (_context, next) => {
        order.push('middleware')
        await next()
      })
      bot.on('message', async () => { order.push('handler') })
      await bot.processBody(makeBody())
      assert.deepEqual(order, ['middleware', 'handler'])
    })

    it('runs multiple middleware in registration order', async () => {
      const bot = new BotApplication()
      const order: string[] = []
      bot.use(async (_ctx, next) => { order.push('mw1'); await next() })
      bot.use(async (_ctx, next) => { order.push('mw2'); await next() })
      bot.on('message', async () => { order.push('handler') })
      await bot.processBody(makeBody())
      assert.deepEqual(order, ['mw1', 'mw2', 'handler'])
    })

    it('middleware can short-circuit by not calling next', async () => {
      const bot = new BotApplication()
      let handlerCalled = false
      bot.use(async () => { /* no next() */ })
      bot.on('message', async () => { handlerCalled = true })
      await bot.processBody(makeBody())
      assert.equal(handlerCalled, false)
    })

    it('middleware receives TurnContext with activity and app', async () => {
      const bot = new BotApplication()
      let ctx: TurnContext | undefined
      bot.use(async (context, next) => {
        ctx = context
        await next()
      })
      bot.on('message', async () => {})
      await bot.processBody(makeBody())
      assert.ok(ctx)
      assert.equal(ctx.activity.type, 'message')
      assert.equal(ctx.app, bot)
    })

    it('catches middleware error thrown after awaiting next()', async () => {
      const bot = new BotApplication()
      const postNextError = new Error('post-next error')
      bot.use(async (_ctx, next) => {
        await next()
        throw postNextError
      })
      bot.on('message', async () => {})
      const err = await bot.processBody(makeBody()).catch((e: unknown) => e)
      assert.ok(err instanceof Error)
      assert.equal((err as Error).message, 'post-next error')
    })

    it('catches error when middleware calls next() without await and throws', async () => {
      const bot = new BotApplication()
      bot.use(async (_ctx, next) => {
        next()
        throw new Error('fire-and-forget error')
      })
      bot.on('message', async () => {})
      const err = await bot.processBody(makeBody()).catch((e: unknown) => e)
      assert.ok(err instanceof Error)
      assert.equal((err as Error).message, 'fire-and-forget error')
    })

    it('propagates handler error when middleware calls next() without await', async () => {
      const bot = new BotApplication()
      bot.use(async (_ctx, next) => {
        next()
      })
      bot.on('message', async () => { throw new Error('handler boom') })
      const err = await bot.processBody(makeBody()).catch((e: unknown) => e)
      assert.ok(err instanceof BotHandlerException)
      assert.equal((err.cause as Error).message, 'handler boom')
    })
  })

  describe('onInvoke', () => {
    it('dispatches invoke activity to registered handler by name', async () => {
      const bot = new BotApplication()
      let received: TurnContext | undefined
      bot.onInvoke('adaptiveCard/action', async (ctx) => {
        received = ctx
        return { status: 200, body: { ok: true } }
      })
      const result = await bot.processBody(makeBody({ type: 'invoke', name: 'adaptiveCard/action' }))
      assert.ok(received)
      assert.equal(received.activity.type, 'invoke')
      assert.deepEqual(result, { status: 200, body: { ok: true } })
    })

    it('returns 501 when no invoke handlers registered at all', async () => {
      const bot = new BotApplication()
      const result = await bot.processBody(makeBody({ type: 'invoke', name: 'task/fetch' }))
      assert.deepEqual(result, { status: 501 })
    })

    it('returns 501 when invoke activity has no name and no handlers registered', async () => {
      const bot = new BotApplication()
      const result = await bot.processBody(makeBody({ type: 'invoke' }))
      assert.deepEqual(result, { status: 501 })
    })

    it('returns 501 when invoke handlers exist but none match the name', async () => {
      const bot = new BotApplication()
      bot.onInvoke('adaptiveCard/action', async () => ({ status: 200, body: { ok: true } }))
      const result = await bot.processBody(makeBody({ type: 'invoke', name: 'task/fetch' }))
      assert.deepEqual(result, { status: 501 })
    })

    it('returns 501 when invoke handlers exist but activity has no name', async () => {
      const bot = new BotApplication()
      bot.onInvoke('adaptiveCard/action', async () => ({ status: 200 }))
      const result = await bot.processBody(makeBody({ type: 'invoke' }))
      assert.deepEqual(result, { status: 501 })
    })

    it('replaces handler when same invoke name registered twice', async () => {
      const bot = new BotApplication()
      const calls: string[] = []
      bot.onInvoke('task/fetch', async () => { calls.push('first'); return { status: 200 } })
      bot.onInvoke('task/fetch', async () => { calls.push('second'); return { status: 200 } })
      await bot.processBody(makeBody({ type: 'invoke', name: 'task/fetch' }))
      assert.deepEqual(calls, ['second'])
    })

    it('wraps invoke handler errors in BotHandlerException', async () => {
      const bot = new BotApplication()
      const cause = new Error('invoke boom')
      bot.onInvoke('task/submit', async () => { throw cause })
      const err = await bot.processBody(makeBody({ type: 'invoke', name: 'task/submit' })).catch((e: unknown) => e)
      assert.ok(err instanceof BotHandlerException)
      assert.equal(err.cause, cause)
      assert.equal(err.activity.type, 'invoke')
    })

    it('returns undefined for non-invoke activities', async () => {
      const bot = new BotApplication()
      bot.on('message', async () => {})
      const result = await bot.processBody(makeBody({ type: 'message' }))
      assert.equal(result, undefined)
    })

    it('processAsync writes invoke response status and body', async () => {
      const { createServer } = await import('node:http')
      const bot = new BotApplication()
      bot.onInvoke('adaptiveCard/action', async () => ({
        status: 200,
        body: { statusCode: 200, type: 'application/vnd.microsoft.card.adaptive' }
      }))

      const server = createServer((req, res) => { bot.processAsync(req, res) })
      await new Promise<void>((resolve) => server.listen(0, resolve))
      const addr = server.address() as { port: number }

      const response = await fetch(`http://localhost:${addr.port}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: makeBody({ type: 'invoke', name: 'adaptiveCard/action' })
      })
      const json = await response.json() as unknown
      server.close()

      assert.equal(response.status, 200)
      assert.deepEqual(json, { statusCode: 200, type: 'application/vnd.microsoft.card.adaptive' })
    })

    it('processAsync returns 400 for missing required fields', async () => {
      const { createServer } = await import('node:http')
      const bot = new BotApplication()

      const server = createServer((req, res) => { bot.processAsync(req, res) })
      await new Promise<void>((resolve) => server.listen(0, resolve))
      const addr = server.address() as { port: number }

      const response = await fetch(`http://localhost:${addr.port}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation: { id: 'c' } })
      })
      const json = await response.json() as { error: string }
      server.close()

      assert.equal(response.status, 400)
      assert.match(json.error, /type/)
    })

    it('processAsync returns 400 for empty serviceUrl', async () => {
      const { createServer } = await import('node:http')
      const bot = new BotApplication()

      const server = createServer((req, res) => { bot.processAsync(req, res) })
      await new Promise<void>((resolve) => server.listen(0, resolve))
      const addr = server.address() as { port: number }

      const response = await fetch(`http://localhost:${addr.port}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'message', serviceUrl: '', conversation: { id: 'c' } })
      })
      const json = await response.json() as { error: string }
      server.close()

      assert.equal(response.status, 400)
      assert.match(json.error, /serviceUrl/)
    })
  })
})
