import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateBotToken, BotAuthError } from './bot-auth-middleware.js'

/**
 * Build a fake JWT token with the given payload.
 * The signature is invalid, but peekClaims() doesn't verify it.
 */
function makeUnsignedToken (payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-key' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.fakesignature`
}

describe('validateBotToken — early issuer validation', () => {
  it('rejects token with no iss claim before any network request', async () => {
    const token = makeUnsignedToken({ tid: 'tenant-id', aud: 'client-id' })
    const err = await validateBotToken(`Bearer ${token}`, 'client-id').catch(e => e)
    assert.ok(err instanceof BotAuthError)
    assert.match(err.message, /Untrusted token issuer/)
  })

  it('rejects token with arbitrary attacker-controlled iss', async () => {
    const token = makeUnsignedToken({ iss: 'https://evil.attacker.com', tid: 'tenant-id', aud: 'client-id' })
    const err = await validateBotToken(`Bearer ${token}`, 'client-id').catch(e => e)
    assert.ok(err instanceof BotAuthError)
    assert.match(err.message, /Untrusted token issuer/)
  })

  it('rejects token whose iss does not match its own tid', async () => {
    const token = makeUnsignedToken({
      iss: 'https://sts.windows.net/other-tenant/',
      tid: 'my-tenant',
      aud: 'client-id',
    })
    const err = await validateBotToken(`Bearer ${token}`, 'client-id').catch(e => e)
    assert.ok(err instanceof BotAuthError)
    assert.match(err.message, /Untrusted token issuer/)
  })

  it('rejects token with sts issuer but no tid claim', async () => {
    const token = makeUnsignedToken({ iss: 'https://sts.windows.net/some-tenant/', aud: 'client-id' })
    const err = await validateBotToken(`Bearer ${token}`, 'client-id').catch(e => e)
    assert.ok(err instanceof BotAuthError)
    assert.match(err.message, /Untrusted token issuer/)
  })

  it('rejects missing Authorization header', async () => {
    const err = await validateBotToken(undefined, 'client-id').catch(e => e)
    assert.ok(err instanceof BotAuthError)
    assert.match(err.message, /Authorization/)
  })

  it('rejects malformed Authorization header (no Bearer prefix)', async () => {
    const token = makeUnsignedToken({ iss: 'https://api.botframework.com', aud: 'client-id' })
    const err = await validateBotToken(token, 'client-id').catch(e => e)
    assert.ok(err instanceof BotAuthError)
    assert.match(err.message, /Authorization/)
  })

  it('rejects when no appId is configured', async () => {
    const token = makeUnsignedToken({ iss: 'https://api.botframework.com', aud: 'client-id' })
    const savedEnv = process.env['CLIENT_ID']
    delete process.env['CLIENT_ID']
    try {
      const err = await validateBotToken(`Bearer ${token}`).catch(e => e)
      assert.ok(err instanceof BotAuthError)
      assert.match(err.message, /appId/)
    } finally {
      if (savedEnv !== undefined) process.env['CLIENT_ID'] = savedEnv
    }
  })
})
