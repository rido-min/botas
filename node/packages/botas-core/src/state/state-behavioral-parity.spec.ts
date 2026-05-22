// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import { BotApplication } from '../bot-application.js'
import { MemoryStorage } from './memory-storage.js'
import type { CoreActivity, Storage } from '../index.js'

/**
 * Cross-language behavioral parity tests for TurnState.
 * These tests mirror identical scenarios in .NET and Python to ensure behavioral consistency.
 */
describe('State Behavioral Parity', () => {
  const createTestActivity = (): CoreActivity => ({
    type: 'message',
    channelId: 'msteams',
    serviceUrl: 'http://localhost:3978/',
    from: { id: 'user-456', name: 'Test User' },
    recipient: { id: 'bot-123', name: 'Test Bot' },
    conversation: { id: 'conv-789' },
    timestamp: new Date().toISOString(),
    text: 'hello',
  })

  /**
   * Scenario 1: Atomic on error — state changes are NOT persisted when handler throws.
   */
  it('Atomic on error: state NOT persisted when handler throws', async () => {
    const bot = new BotApplication()
    const storage = new MemoryStorage()
    bot.useState(storage)

    bot.on('message', async (ctx) => {
      // Mutate state
      ctx.state?.conversation.set('count', 999)
      ctx.state?.user.set('name', 'should-not-persist')
      
      // Then throw
      throw new Error('Handler error')
    })

    try {
      await bot.processBody(JSON.stringify(createTestActivity()))
    } catch (err) {
      // Expected
    }

    // Verify NO state was persisted
    const convKey = 'msteams/bot-123/conversations/conv-789'
    const userKey = 'msteams/bot-123/users/user-456'
    const result = await storage.read([convKey, userKey])
    
    assert.deepStrictEqual(result, {})
  })

  /**
   * Scenario 2: Successful turn persists — state changes are visible on next turn.
   */
  it('Successful turn: state IS persisted and visible on next turn', async () => {
    const bot = new BotApplication()
    const storage = new MemoryStorage()
    bot.useState(storage)

    // First turn: write state
    bot.on('message', async (ctx) => {
      ctx.state?.conversation.set('count', 42)
      ctx.state?.user.set('name', 'Alice')
    })

    await bot.processBody(JSON.stringify(createTestActivity()))

    // Verify state was persisted
    const convKey = 'msteams/bot-123/conversations/conv-789'
    const userKey = 'msteams/bot-123/users/user-456'
    const result = await storage.read([convKey, userKey])
    
    assert.strictEqual(convKey in result, true)
    assert.strictEqual(userKey in result, true)
    assert.deepStrictEqual(result[convKey], { count: 42 })
    assert.deepStrictEqual(result[userKey], { name: 'Alice' })

    // Second turn: read state (fresh TurnState instance)
    let readCount = 0
    let readName = ''
    
    bot.on('message', async (ctx) => {
      readCount = ctx.state?.conversation.get<number>('count') ?? 0
      readName = ctx.state?.user.get<string>('name') ?? ''
    })

    await bot.processBody(JSON.stringify(createTestActivity()))

    assert.strictEqual(readCount, 42)
    assert.strictEqual(readName, 'Alice')
  })

  /**
   * Scenario 3: Dirty tracking — reading without mutation does NOT trigger write.
   */
  it('Dirty tracking: no write when state only read', async () => {
    const bot = new BotApplication()
    
    let writeCallCount = 0
    const storage: Storage = {
      read: async (keys: string[]) => {
        const convKey = 'msteams/bot-123/conversations/conv-789'
        if (keys.includes(convKey)) {
          return { [convKey]: { count: 5 } }
        }
        return {}
      },
      write: async () => {
        writeCallCount++
      },
      delete: async () => {},
    }
    
    bot.useState(storage)

    bot.on('message', async (ctx) => {
      // Read but don't mutate
      const count = ctx.state?.conversation.get<number>('count')
      assert.strictEqual(count, 5)
    })

    await bot.processBody(JSON.stringify(createTestActivity()))

    // Verify write was NOT called (dirty tracking prevented unnecessary persistence)
    assert.strictEqual(writeCallCount, 0)
  })

  /**
   * Scenario 4: Scope isolation — writing to one scope does NOT affect others.
   */
  it('Scope isolation: conversation write does NOT affect user scope', async () => {
    const bot = new BotApplication()
    const storage = new MemoryStorage()
    bot.useState(storage)

    // First turn: write ONLY to conversation scope
    bot.on('message', async (ctx) => {
      ctx.state?.conversation.set('data', 'conversation-data')
      // Do NOT write to user scope
    })

    await bot.processBody(JSON.stringify(createTestActivity()))

    // Verify conversation scope was persisted
    const convKey = 'msteams/bot-123/conversations/conv-789'
    const userKey = 'msteams/bot-123/users/user-456'
    const result = await storage.read([convKey, userKey])
    
    assert.strictEqual(convKey in result, true)
    assert.strictEqual(userKey in result, false) // User key should NOT exist

    // Second turn: verify user scope reads return undefined
    let userData: unknown = 'unset'
    
    bot.on('message', async (ctx) => {
      userData = ctx.state?.user.get<string>('data')
    })

    await bot.processBody(JSON.stringify(createTestActivity()))

    assert.strictEqual(userData, undefined)
  })
})
