import { describe, it, afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { BotApp } from './bot-app.js'
import { botAuthExpress } from './bot-auth-express.js'
import type { TurnContext } from 'botas-core'

// Helpers ────────────────────────────────────────────────────────────────────

function freePort (): number {
  // Use 0 to let the OS assign a free port
  return 0
}

function post (port: number, path: string, body: string, headers: Record<string, string> = {}): Promise<{ status: number, body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', ...headers } },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode!, body: Buffer.concat(chunks).toString() }))
      }
    )
    req.on('error', reject)
    req.end(body)
  })
}

function get (port: number, path: string): Promise<{ status: number, body: string }> {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port, path }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode!, body: Buffer.concat(chunks).toString() }))
    }).on('error', reject)
  })
}

const testActivity = JSON.stringify({
  type: 'message',
  serviceUrl: 'https://smba.trafficmanager.botframework.com/api',
  from: { id: 'user1' },
  recipient: { id: 'bot1' },
  conversation: { id: 'conv1' },
  text: 'hello',
})

// Tests ──────────────────────────────────────────────────────────────────────

describe('BotApp', () => {
  let server: http.Server | undefined

  afterEach(() => {
    if (server) {
      server.close()
      server = undefined
    }
  })

  it('start() returns an http.Server', () => {
    const app = new BotApp({ port: freePort(), auth: false })
    server = app.start()
    assert.ok(server instanceof http.Server)
  })

  it('POST /api/messages dispatches to handler', async () => {
    const app = new BotApp({ port: freePort(), auth: false })
    let received: TurnContext | undefined
    app.on('message', async (ctx) => { received = ctx })
    server = app.start()
    const addr = server.address() as { port: number }

    const res = await post(addr.port, '/api/messages', testActivity)
    assert.equal(res.status, 200)
    assert.equal(res.body, '{}')
    assert.ok(received)
    assert.equal(received.activity.text, 'hello')
  })

  it('GET /health returns ok', async () => {
    const app = new BotApp({ port: freePort(), auth: false })
    server = app.start()
    const addr = server.address() as { port: number }

    const res = await get(addr.port, '/health')
    assert.equal(res.status, 200)
    assert.deepEqual(JSON.parse(res.body), { status: 'ok' })
  })

  it('GET /api/messages returns 405 Method Not Allowed', async () => {
    const app = new BotApp({ port: freePort(), auth: false })
    server = app.start()
    const addr = server.address() as { port: number }

    const res = await get(addr.port, '/api/messages')
    assert.equal(res.status, 405)
    assert.ok(res.body.includes('Method Not Allowed'))
  })

  it('GET / returns status page', async () => {
    const app = new BotApp({ port: freePort(), auth: false })
    server = app.start()
    const addr = server.address() as { port: number }

    const res = await get(addr.port, '/')
    assert.equal(res.status, 200)
    assert.ok(res.body.includes('is running'))
  })

  it('supports custom path', async () => {
    const app = new BotApp({ port: freePort(), auth: false, path: '/bot' })
    let called = false
    app.on('message', async () => { called = true })
    server = app.start()
    const addr = server.address() as { port: number }

    const res = await post(addr.port, '/bot', testActivity)
    assert.equal(res.status, 200)
    assert.ok(called)
  })

  it('delegates use() to underlying BotApplication', async () => {
    const app = new BotApp({ port: freePort(), auth: false })
    const order: string[] = []
    app.use(async (_ctx, next) => {
      order.push('mw')
      await next()
    })
    app.on('message', async () => { order.push('handler') })
    server = app.start()
    const addr = server.address() as { port: number }

    await post(addr.port, '/api/messages', testActivity)
    assert.deepEqual(order, ['mw', 'handler'])
  })

  it('server can be closed for cleanup', async () => {
    const app = new BotApp({ port: freePort(), auth: false })
    server = app.start()
    await new Promise<void>((resolve) => { server!.close(() => resolve()) })
    server = undefined
  })
})

// ── #95: botAuthExpress startup validation ───────────────────────────────────

describe('botAuthExpress startup validation (#95)', () => {
  let originalClientId: string | undefined

  beforeEach(() => {
    originalClientId = process.env['CLIENT_ID']
    delete process.env['CLIENT_ID']
  })

  afterEach(() => {
    if (originalClientId !== undefined) {
      process.env['CLIENT_ID'] = originalClientId
    } else {
      delete process.env['CLIENT_ID']
    }
  })

  it('throws at setup when CLIENT_ID is missing', () => {
    assert.throws(
      () => botAuthExpress(),
      /CLIENT_ID/,
      'Should throw clear error about missing CLIENT_ID'
    )
  })

  it('succeeds when appId is provided explicitly', () => {
    assert.doesNotThrow(() => botAuthExpress('explicit-app-id'))
  })
})

// ── #247: Auth 401 returns JSON error format ─────────────────────────────────

describe('botAuthExpress 401 JSON response (#247)', () => {
  it('returns JSON { error, message } on missing auth header', async () => {
    const middleware = botAuthExpress('test-app-id')

    const req = { headers: {} }
    let statusCode = 0
    let jsonBody: unknown
    const res = {
      status (code: number) { statusCode = code; return this },
      end () { /* noop */ },
      json (body: unknown) { jsonBody = body },
    }
    const next = () => { /* noop */ }

    await middleware(req, res, next)

    assert.equal(statusCode, 401)
    assert.ok(jsonBody, 'Should have called res.json()')
    const body = jsonBody as { error: string; message: string }
    assert.equal(body.error, 'Unauthorized')
    assert.ok(body.message.length > 0, 'Should include an error message')
  })

  it('returns JSON { error, message } on invalid token', async () => {
    const middleware = botAuthExpress('test-app-id')

    const req = { headers: { authorization: 'Bearer invalid-token' } }
    let statusCode = 0
    let jsonBody: unknown
    const res = {
      status (code: number) { statusCode = code; return this },
      end () { /* noop */ },
      json (body: unknown) { jsonBody = body },
    }
    let nextCalled = false
    const next = (err?: unknown) => { nextCalled = true; void err }

    await middleware(req, res, next)

    assert.equal(statusCode, 401)
    assert.equal(nextCalled, false)
    assert.ok(jsonBody, 'Should have called res.json()')
    const body = jsonBody as { error: string; message: string }
    assert.equal(body.error, 'Unauthorized')
    assert.ok(body.message.length > 0, 'Should include an error message')
  })
})
