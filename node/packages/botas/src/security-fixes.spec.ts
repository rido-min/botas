import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { BotApplication, BotHandlerException } from './bot-application.js'
import { validateServiceUrl, BotAuthError } from './bot-auth-middleware.js'
import type { CoreActivity } from './core-activity.js'

// ── #91 SSRF: serviceUrl validation ──────────────────────────────────────────

describe('validateServiceUrl (#91 SSRF protection)', () => {
  it('allows *.botframework.com URLs', () => {
    assert.doesNotThrow(() => validateServiceUrl('https://smba.trafficmanager.net.botframework.com/'))
    assert.doesNotThrow(() => validateServiceUrl('https://webchat.botframework.com/'))
  })

  it('allows *.botframework.us (government cloud)', () => {
    assert.doesNotThrow(() => validateServiceUrl('https://webchat.botframework.us/'))
  })

  it('allows *.botframework.cn (China cloud)', () => {
    assert.doesNotThrow(() => validateServiceUrl('https://webchat.botframework.cn/'))
  })

  it('allows *.trafficmanager.net (Azure Traffic Manager)', () => {
    assert.doesNotThrow(() => validateServiceUrl('https://smba.trafficmanager.net/amer/'))
  })

  it('allows localhost for development', () => {
    assert.doesNotThrow(() => validateServiceUrl('http://localhost:3978/'))
    assert.doesNotThrow(() => validateServiceUrl('http://127.0.0.1:3978/'))
  })

  it('rejects arbitrary URLs', () => {
    assert.throws(() => validateServiceUrl('https://evil.attacker.com/'), BotAuthError)
  })

  it('rejects URLs with botframework in path but not hostname', () => {
    assert.throws(() => validateServiceUrl('https://evil.com/botframework.com/'), BotAuthError)
  })

  it('rejects invalid URLs', () => {
    assert.throws(() => validateServiceUrl('not-a-url'), BotAuthError)
  })

  it('is case-insensitive for hostname matching', () => {
    assert.doesNotThrow(() => validateServiceUrl('https://WEBCHAT.BOTFRAMEWORK.COM/'))
  })
})

// ── #91 Integration: processBody rejects untrusted serviceUrl ────────────────

describe('processBody rejects untrusted serviceUrl (#91)', () => {
  it('throws BotAuthError for attacker-controlled serviceUrl', async () => {
    const bot = new BotApplication()
    bot.on('message', async () => {})
    const body = JSON.stringify({
      type: 'message',
      serviceUrl: 'https://evil.attacker.com/',
      conversation: { id: 'c1' },
      text: 'hi',
    })
    const err = await bot.processBody(body).catch((e: unknown) => e)
    assert.ok(err instanceof BotAuthError)
    assert.match(err.message, /Untrusted serviceUrl/)
  })
})

// ── #67 Middleware pipeline error handling ────────────────────────────────────

describe('middleware pipeline error handling (#67)', () => {
  const baseCoreActivity: CoreActivity = {
    type: 'message',
    serviceUrl: 'http://localhost:3978/',
    from: { id: 'user1' },
    recipient: { id: 'bot1' },
    conversation: { id: 'conv1' },
    text: 'hello',
  }

  function makeBody (overrides: Partial<CoreActivity> = {}): string {
    return JSON.stringify({ ...baseCoreActivity, ...overrides })
  }

  it('propagates post-next() middleware error with original message', async () => {
    const bot = new BotApplication()
    bot.use(async (_ctx, next) => {
      await next()
      throw new Error('post-next explosion')
    })
    bot.on('message', async () => {})
    const err = await bot.processBody(makeBody()).catch((e: unknown) => e)
    assert.ok(err instanceof Error)
    assert.equal((err as Error).message, 'post-next explosion')
  })

  it('preserves BotHandlerException from handler through middleware', async () => {
    const bot = new BotApplication()
    bot.use(async (_ctx, next) => { await next() })
    const cause = new Error('handler boom')
    bot.on('message', async () => { throw cause })
    const err = await bot.processBody(makeBody()).catch((e: unknown) => e)
    assert.ok(err instanceof BotHandlerException)
    assert.equal(err.cause, cause)
  })

  it('propagates middleware error thrown before next() with original message', async () => {
    const bot = new BotApplication()
    bot.use(async () => { throw new Error('pre-next boom') })
    bot.on('message', async () => {})
    const err = await bot.processBody(makeBody()).catch((e: unknown) => e)
    assert.ok(err instanceof Error)
    assert.equal((err as Error).message, 'pre-next boom')
  })
})
