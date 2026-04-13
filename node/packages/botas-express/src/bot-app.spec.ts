import { describe, it, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { BotApp } from './bot-app.js'
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
  serviceUrl: 'http://service.url',
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
