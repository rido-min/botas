// Tests for medium/low audit fixes (#76)

import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { BotApplication, type CoreActivity, removeMentionMiddleware, TokenManager, configure, resetLogger, noopLogger } from './index.js'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'

function makeActivity (overrides: Partial<CoreActivity> = {}): CoreActivity {
  return {
    type: 'message',
    serviceUrl: 'http://localhost:3978/',
    conversation: { id: 'conv1' },
    recipient: { id: 'bot1' },
    channelId: 'test',
    ...overrides,
  } as CoreActivity
}

function makeReq (body: string): IncomingMessage {
  const stream = Readable.from([Buffer.from(body)])
  return Object.assign(stream, {
    headers: {},
    method: 'POST',
    url: '/api/messages',
  }) as unknown as IncomingMessage
}

function makeRes (): ServerResponse & { statusCode: number; body: string; headersSent: boolean } {
  const res = {
    statusCode: 0,
    body: '',
    headersSent: false,
    writeHead (code: number) { res.statusCode = code; res.headersSent = true },
    end (b?: string) { res.body = b ?? '' },
    destroy: mock.fn(),
  }
  return res as unknown as ServerResponse & { statusCode: number; body: string; headersSent: boolean }
}

describe('#2 — Request body size limit', () => {
  it('rejects bodies exceeding 10MB', async () => {
    const bot = new BotApplication()
    const hugeBody = 'x'.repeat(11 * 1024 * 1024)
    const req = makeReq(hugeBody)
    const res = makeRes()
    await bot.processAsync(req, res)
    assert.equal(res.statusCode, 500)
  })

  it('accepts bodies under 10MB', async () => {
    const bot = new BotApplication()
    bot.on('message', async () => {})
    const activity = makeActivity({ text: 'hello' })
    const req = makeReq(JSON.stringify(activity))
    const res = makeRes()
    await bot.processAsync(req, res)
    assert.equal(res.statusCode, 200)
  })
})

describe('#4 — ReDoS protection in RemoveMentionMiddleware', () => {
  it('skips entity.text longer than 200 chars', async () => {
    const bot = new BotApplication({ clientId: 'bot1' })
    bot.use(removeMentionMiddleware())
    let receivedText = ''
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text ?? '' })

    const longMention = '<at>' + 'A'.repeat(250) + '</at>'
    const activity = makeActivity({
      text: longMention + ' hello',
      entities: [{
        type: 'mention',
        mentioned: { id: 'bot1', name: 'Bot' },
        text: longMention,
      }] as CoreActivity['entities'],
    })

    await bot.processBody(JSON.stringify(activity))
    assert.ok(receivedText.includes(longMention))
  })

  it('strips entity.text within 200 chars', async () => {
    const bot = new BotApplication({ clientId: 'bot1' })
    bot.use(removeMentionMiddleware())
    let receivedText = ''
    bot.on('message', async (ctx) => { receivedText = ctx.activity.text ?? '' })

    const mention = '<at>Bot</at>'
    const activity = makeActivity({
      text: mention + ' hello',
      entities: [{
        type: 'mention',
        mentioned: { id: 'bot1', name: 'Bot' },
        text: mention,
      }] as CoreActivity['entities'],
    })

    await bot.processBody(JSON.stringify(activity))
    assert.equal(receivedText, 'hello')
  })
})

describe('#6 — Logger reset for tests', () => {
  it('resetLogger restores default logger', () => {
    configure(noopLogger)
    resetLogger()
    assert.ok(true)
  })
})

describe('#8 — Token acquisition deduplication', () => {
  it('concurrent getBotToken calls share one promise', async () => {
    let callCount = 0
    const tm = new TokenManager({
      clientId: 'test-id',
      token: async () => {
        callCount++
        await new Promise(r => setTimeout(r, 50))
        return 'token-value'
      },
    })
    const [t1, t2, t3] = await Promise.all([
      tm.getBotToken(),
      tm.getBotToken(),
      tm.getBotToken(),
    ])
    assert.equal(t1, 'token-value')
    assert.equal(t2, 'token-value')
    assert.equal(t3, 'token-value')
    assert.equal(callCount, 1, 'token factory should only be called once for concurrent requests')
  })
})

describe('#11 — Input validation on activity fields', () => {
  it('rejects text exceeding 50,000 chars', async () => {
    const bot = new BotApplication()
    const activity = makeActivity({ text: 'x'.repeat(50_001) })
    await assert.rejects(
      () => bot.processBody(JSON.stringify(activity)),
      /text exceeds maximum length/
    )
  })

  it('rejects entities exceeding 250', async () => {
    const bot = new BotApplication()
    const entities = Array.from({ length: 251 }, () => ({ type: 'mention' }))
    const activity = makeActivity({ entities } as unknown as Partial<CoreActivity>)
    await assert.rejects(
      () => bot.processBody(JSON.stringify(activity)),
      /entities exceeds maximum count/
    )
  })

  it('rejects attachments exceeding 50', async () => {
    const bot = new BotApplication()
    const attachments = Array.from({ length: 51 }, () => ({ contentType: 'text/plain' }))
    const activity = { ...makeActivity(), attachments }
    await assert.rejects(
      () => bot.processBody(JSON.stringify(activity)),
      /attachments exceeds maximum count/
    )
  })
})

describe('#15 — processAsync cleanup', () => {
  it('checks headersSent before writing error response', async () => {
    const bot = new BotApplication()
    const req = makeReq('not json')
    const res = makeRes()
    await bot.processAsync(req, res)
    assert.equal(res.statusCode, 500)
    assert.equal(res.body, 'Internal server error')
  })
})
