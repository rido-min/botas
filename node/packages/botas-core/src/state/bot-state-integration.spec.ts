// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { BotApplication } from '../bot-application.js'
import { MemoryStorage } from './memory-storage.js'
import type { CoreActivity } from '../core-activity.js'

describe('BotApplication with State', () => {
  const createTestActivity = (): CoreActivity => ({
    type: 'message',
    channelId: 'msteams',
    serviceUrl: 'https://smba.trafficmanager.net/amer/',
    from: { id: 'user-123', name: 'Test User' },
    recipient: { id: 'bot-456', name: 'Test Bot' },
    conversation: { id: 'conv-789' },
    timestamp: new Date().toISOString(),
    text: 'hello',
  })

  it('should attach state to context when storage configured', async () => {
    const bot = new BotApplication()
    const storage = new MemoryStorage()
    bot.useState(storage)

    let capturedState: unknown = undefined
    bot.on('message', async (ctx) => {
      capturedState = ctx.state
    })

    await bot.processBody(JSON.stringify(createTestActivity()))

    assert.notEqual(capturedState, undefined)
  })

  it('should not attach state when storage not configured', async () => {
    const bot = new BotApplication()

    let capturedState: unknown = 'unset'
    bot.on('message', async (ctx) => {
      capturedState = ctx.state
    })

    await bot.processBody(JSON.stringify(createTestActivity()))

    assert.strictEqual(capturedState, undefined)
  })

  it('should persist state changes on successful turn', async () => {
    const bot = new BotApplication()
    const storage = new MemoryStorage()
    bot.useState(storage)

    bot.on('message', async (ctx) => {
      const count = ctx.state?.conversation.get<number>('count') ?? 0
      ctx.state?.conversation.set('count', count + 1)
    })

    await bot.processBody(JSON.stringify(createTestActivity()))
    await bot.processBody(JSON.stringify(createTestActivity()))

    const result = await storage.read(['msteams/bot-456/conversations/conv-789'])
    assert.deepStrictEqual(result['msteams/bot-456/conversations/conv-789'], { count: 2 })
  })

  it('should NOT persist state changes when handler throws', async () => {
    const bot = new BotApplication()
    const storage = new MemoryStorage()
    bot.useState(storage)

    await storage.write({
      'msteams/bot-456/conversations/conv-789': { count: 1 }
    })

    bot.on('message', async (ctx) => {
      ctx.state?.conversation.set('count', 999)
      throw new Error('Handler failed')
    })

    try {
      await bot.processBody(JSON.stringify(createTestActivity()))
    } catch (err) {
      // Expected
    }

    const result = await storage.read(['msteams/bot-456/conversations/conv-789'])
    assert.deepStrictEqual(result['msteams/bot-456/conversations/conv-789'], { count: 1 })
  })

  it('should NOT persist state changes when middleware throws', async () => {
    const bot = new BotApplication()
    const storage = new MemoryStorage()
    bot.useState(storage)

    bot.use(async (ctx) => {
      ctx.state?.conversation.set('shouldNotSave', 'value')
      throw new Error('Middleware failed')
    })

    bot.on('message', async () => {})

    try {
      await bot.processBody(JSON.stringify(createTestActivity()))
    } catch (err) {
      // Expected
    }

    const result = await storage.read(['msteams/bot-456/conversations/conv-789'])
    assert.deepStrictEqual(result, {})
  })

  it('should preserve state across middleware and handler', async () => {
    const bot = new BotApplication()
    const storage = new MemoryStorage()
    bot.useState(storage)

    bot.use(async (ctx, next) => {
      ctx.state?.temp.set('middlewareValue', 'from-middleware')
      await next()
    })

    let capturedValue: unknown = undefined
    bot.on('message', async (ctx) => {
      capturedValue = ctx.state?.temp.get('middlewareValue')
      ctx.state?.conversation.set('finalValue', 'from-handler')
    })

    await bot.processBody(JSON.stringify(createTestActivity()))

    assert.strictEqual(capturedValue, 'from-middleware')
    
    const result = await storage.read(['msteams/bot-456/conversations/conv-789'])
    assert.deepStrictEqual(result['msteams/bot-456/conversations/conv-789'], { finalValue: 'from-handler' })
  })

  it('should handle storage load failure', async () => {
    const bot = new BotApplication()
    
    const failingStorage = {
      read: mock.fn(() => Promise.reject(new Error('Storage read failed'))),
      write: mock.fn(),
      delete: mock.fn()
    }
    
    bot.useState(failingStorage)
    bot.on('message', async () => {})

    await assert.rejects(
      async () => bot.processBody(JSON.stringify(createTestActivity())),
      /State load failed/
    )
  })

  it('should not fail turn when storage save fails', async () => {
    const bot = new BotApplication()
    
    const failingStorage = {
      read: mock.fn(() => Promise.resolve({})),
      write: mock.fn(() => Promise.reject(new Error('Storage write failed'))),
      delete: mock.fn()
    }
    
    bot.useState(failingStorage)

    let handlerRan = false
    bot.on('message', async (ctx) => {
      ctx.state?.conversation.set('key', 'value')
      handlerRan = true
    })

    await bot.processBody(JSON.stringify(createTestActivity()))
    assert.strictEqual(handlerRan, true)
  })

  it('should support temp scope for per-turn data', async () => {
    const bot = new BotApplication()
    const storage = new MemoryStorage()
    bot.useState(storage)

    bot.on('message', async (ctx) => {
      ctx.state?.temp.set('turnData', 'ephemeral')
    })

    await bot.processBody(JSON.stringify(createTestActivity()))

    const result = await storage.read(['msteams/bot-456/conversations/conv-789'])
    assert.deepStrictEqual(result, {})
  })
})
