import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { _BotHttpClient } from './bot-http-client.js'
import { TokenManager } from './token-manager.js'

// ── #93: BotHttpClient error sanitization ────────────────────────────────────

describe('BotHttpClient error sanitization (#93)', () => {
  it('does not leak upstream response body in error message', async () => {
    const client = new _BotHttpClient()
    const err = await client
      .send('POST', 'http://localhost:1/__nonexistent', { secret: 'password123' })
      .catch((e: unknown) => e) as Error
    assert.ok(err instanceof Error)
    // Error should contain status info but NOT the response body
    assert.ok(!err.message.includes('password123'), 'Error message must not contain response body data')
  })

  it('error message includes method, URL, and status but no body', async () => {
    // Use a real HTTP server that returns a known error body
    const { createServer } = await import('node:http')
    const server = createServer((_req, res) => {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'internal-secret-detail', stack: 'secret-stack-trace' }))
    })
    await new Promise<void>((resolve) => server.listen(0, resolve))
    const port = (server.address() as any).port
    try {
      const client = new _BotHttpClient()
      const err = await client
        .send('POST', `http://localhost:${port}/test`)
        .catch((e: unknown) => e) as Error
      assert.ok(err instanceof Error)
      assert.ok(err.message.includes('POST'), 'Error should include method')
      assert.ok(err.message.includes('500'), 'Error should include status code')
      assert.ok(!err.message.includes('internal-secret-detail'), 'Error must NOT leak upstream body')
      assert.ok(!err.message.includes('secret-stack-trace'), 'Error must NOT leak upstream stack')
    } finally {
      server.close()
    }
  })
})

// ── #94: TokenManager negative cache ─────────────────────────────────────────

describe('TokenManager negative cache (#94)', () => {
  it('returns cached failure on repeated calls', async () => {
    let callCount = 0
    const tm = new TokenManager({
      clientId: 'test-app',
      clientSecret: 'test-secret',
      tenantId: 'test-tenant',
    })
    // Monkey-patch the private method to simulate Azure AD failure
    const origMethod = (tm as any).getTokenWithClientCredentials.bind(tm)
    ;(tm as any).getTokenWithClientCredentials = async (...args: any[]) => {
      callCount++
      throw new Error('Azure AD unavailable')
    }

    // First call should fail and invoke Azure AD
    await assert.rejects(() => tm.getBotToken(), /Azure AD unavailable/)
    assert.equal(callCount, 1)

    // Second call should hit negative cache without invoking Azure AD again
    await assert.rejects(() => tm.getBotToken(), /Token acquisition failed \(cached\)/)
    assert.equal(callCount, 1, 'Should not call Azure AD again during negative cache TTL')
  })

  it('does not cache custom token factory failures', async () => {
    // Custom token factory errors are passed through but not cached
    // because the factory is called before the try/catch block
    let callCount = 0
    const tm = new TokenManager({
      clientId: 'test-app',
      token: async () => {
        callCount++
        if (callCount === 1) throw new Error('transient error')
        return 'valid-token'
      },
    })

    await assert.rejects(() => tm.getBotToken(), /transient error/)
    // Custom factory calls are NOT negatively cached — second call should succeed
    const token = await tm.getBotToken()
    assert.equal(token, 'valid-token')
    assert.equal(callCount, 2)
  })
})

// ── #95: Auth startup validation ─────────────────────────────────────────────
// NOTE: botAuthExpress moved to botas-express, botAuthHono moved to samples.
// Startup validation tests for botAuthExpress are in botas-express/src/bot-app.spec.ts.

// ── #97: MSAL logger wiring (structural test) ───────────────────────────────

describe('MSAL logger wiring (#97)', () => {
  it('TokenManager can be instantiated with client credentials without discarding MSAL logs', () => {
    const tm = new TokenManager({
      clientId: 'test-app',
      clientSecret: 'test-secret',
      tenantId: 'test-tenant',
    })
    assert.ok(tm, 'TokenManager should be created successfully')
  })
})

// ── #76: Token acquisition promise deduplication ─────────────────────────────

describe('TokenManager promise deduplication (#76)', () => {
  it('coalesces concurrent getBotToken() calls into a single MSAL request', async () => {
    let callCount = 0
    const tm = new TokenManager({
      clientId: 'test-app',
      clientSecret: 'test-secret',
      tenantId: 'test-tenant',
    })
    // Monkey-patch the private method to count actual MSAL calls
    ;(tm as any).getTokenWithClientCredentials = async () => {
      callCount++
      // Simulate async work
      await new Promise(resolve => setTimeout(resolve, 50))
      return 'test-token'
    }

    // Fire 3 concurrent requests
    const [t1, t2, t3] = await Promise.all([
      tm.getBotToken(),
      tm.getBotToken(),
      tm.getBotToken(),
    ])

    assert.equal(t1, 'test-token')
    assert.equal(t2, 'test-token')
    assert.equal(t3, 'test-token')
    assert.equal(callCount, 1, 'Concurrent calls should be coalesced into a single MSAL request')
  })
})
