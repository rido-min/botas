import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { BotApplication, BotHandlerException, RequestBodyTooLargeError } from './bot-application.js'
import type { CoreActivity } from './core-activity.js'
import type { TurnContext } from './turn-context.js'

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

    it('does not pollute Object prototype via __proto__ key', async () => {
      const bot = new BotApplication()
      const malicious = '{"__proto__":{"isAdmin":true},"type":"message","serviceUrl":"http://s","conversation":{"id":"c"}}'
      await bot.processBody(malicious)
      assert.equal((({}) as Record<string, unknown>)['isAdmin'], undefined)
    })

    it('does not pollute Object prototype via constructor key', async () => {
      const bot = new BotApplication()
      const malicious = '{"constructor":{"prototype":{"isAdmin":true}},"type":"message","serviceUrl":"http://s","conversation":{"id":"c"}}'
      await bot.processBody(malicious)
      assert.equal((({}) as Record<string, unknown>)['isAdmin'], undefined)
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

  describe('processAsync body size limit', () => {
    let server: http.Server | undefined

    afterEach(() => {
      if (server) {
        server.close()
        server = undefined
      }
    })

    function postRaw (port: number, body: Buffer): Promise<{ status: number, body: string }> {
      return new Promise((resolve, reject) => {
        const req = http.request(
          { hostname: '127.0.0.1', port, method: 'POST', path: '/', headers: { 'Content-Type': 'application/json' } },
          (res) => {
            const chunks: Buffer[] = []
            res.on('data', (c: Buffer) => chunks.push(c))
            res.on('end', () => resolve({ status: res.statusCode!, body: Buffer.concat(chunks).toString() }))
          }
        )
        req.on('error', (err) => {
          // Connection reset is expected when server destroys the socket
          if ((err as NodeJS.ErrnoException).code === 'ECONNRESET') {
            resolve({ status: 0, body: '' })
          } else {
            reject(err)
          }
        })
        req.end(body)
      })
    }

    it('rejects request bodies larger than 1 MB with 413 or connection reset', async () => {
      const bot = new BotApplication()
      server = http.createServer((req, res) => { bot.processAsync(req, res) })
      await new Promise<void>((resolve) => { server!.listen(0, resolve) })
      const addr = server.address() as { port: number }

      const oversized = Buffer.alloc(1024 * 1024 + 1, 'x')
      const res = await postRaw(addr.port, oversized)
      // Server destroys the socket, so we get either a 413 response or ECONNRESET
      assert.ok(
        res.status === 413 || res.status === 0,
        `Expected 413 or connection reset (0), got ${res.status}`
      )
    })

    it('accepts request bodies within the 1 MB limit', async () => {
      const bot = new BotApplication()
      bot.on('message', async () => {})
      server = http.createServer((req, res) => { bot.processAsync(req, res) })
      await new Promise<void>((resolve) => { server!.listen(0, resolve) })
      const addr = server.address() as { port: number }

      const body = makeBody()
      const res = await postRaw(addr.port, Buffer.from(body))
      assert.equal(res.status, 200)
      assert.equal(res.body, '{}')
    })

    it('RequestBodyTooLargeError has correct name', () => {
      const err = new RequestBodyTooLargeError()
      assert.equal(err.name, 'RequestBodyTooLargeError')
      assert.equal(err.message, 'Request body too large')
      assert.ok(err instanceof Error)
    })
  })
})
