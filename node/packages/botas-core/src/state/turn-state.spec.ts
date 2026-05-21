// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { TurnStateImpl, deriveConversationKey, deriveUserKey } from './turn-state.js'
import { MemoryStorage } from './memory-storage.js'
import type { CoreActivity } from '../core-activity.js'

describe('TurnState', () => {
  const createTestActivity = (): CoreActivity => ({
    type: 'message',
    channelId: 'msteams',
    serviceUrl: 'https://smba.trafficmanager.net/amer/',
    from: { id: 'user-123', name: 'Test User' },
    recipient: { id: 'bot-456', name: 'Test Bot' },
    conversation: { id: 'conv-789' },
    timestamp: new Date().toISOString(),
  })

  describe('Key Derivation', () => {
    it('should derive conversation key correctly', () => {
      const activity = createTestActivity()
      const key = deriveConversationKey(activity)
      assert.strictEqual(key, 'msteams/bot-456/conversations/conv-789')
    })

    it('should derive user key correctly', () => {
      const activity = createTestActivity()
      const key = deriveUserKey(activity)
      assert.strictEqual(key, 'msteams/bot-456/users/user-123')
    })

    it('should throw when activity missing required fields', () => {
      const activity = createTestActivity()
      delete (activity as { channelId?: string }).channelId
      
      assert.throws(() => deriveConversationKey(activity), /missing required fields/)
    })
  })

  describe('Scope Isolation', () => {
    it('should isolate conversation, user, and temp scopes', async () => {
      const storage = new MemoryStorage()
      const activity = createTestActivity()
      
      const state = await TurnStateImpl.loadAsync(storage, activity)
      
      state.conversation.set('convKey', 'convValue')
      state.user.set('userKey', 'userValue')
      state.temp.set('tempKey', 'tempValue')
      
      assert.strictEqual(state.conversation.get('convKey'), 'convValue')
      assert.strictEqual(state.user.get('userKey'), 'userValue')
      assert.strictEqual(state.temp.get('tempKey'), 'tempValue')
      assert.strictEqual(state.conversation.has('userKey'), false)
    })

    it('should load existing state from storage', async () => {
      const storage = new MemoryStorage()
      const activity = createTestActivity()
      
      await storage.write({
        'msteams/bot-456/conversations/conv-789': { count: 42 },
        'msteams/bot-456/users/user-123': { name: 'Alice' }
      })
      
      const state = await TurnStateImpl.loadAsync(storage, activity)
      
      assert.strictEqual(state.conversation.get('count'), 42)
      assert.strictEqual(state.user.get('name'), 'Alice')
    })
  })

  describe('Path Syntax', () => {
    it('should get/set values via path with scope prefix', async () => {
      const storage = new MemoryStorage()
      const activity = createTestActivity()
      const state = await TurnStateImpl.loadAsync(storage, activity)
      
      state.setValue('conversation.count', 10)
      state.setValue('user.name', 'Bob')
      state.setValue('temp.input', 'hello')
      
      assert.strictEqual(state.getValue('conversation.count'), 10)
      assert.strictEqual(state.getValue('user.name'), 'Bob')
      assert.strictEqual(state.getValue('temp.input'), 'hello')
    })

    it('should default to temp scope when no prefix', async () => {
      const storage = new MemoryStorage()
      const activity = createTestActivity()
      const state = await TurnStateImpl.loadAsync(storage, activity)
      
      state.setValue('myKey', 'myValue')
      
      assert.strictEqual(state.getValue('myKey'), 'myValue')
      assert.strictEqual(state.temp.get('myKey'), 'myValue')
    })

    it('should throw on invalid scope name', async () => {
      const storage = new MemoryStorage()
      const activity = createTestActivity()
      const state = await TurnStateImpl.loadAsync(storage, activity)
      
      assert.throws(() => state.getValue('invalid.key'), /Invalid scope/)
    })

    it('should throw on path with multiple dots', async () => {
      const storage = new MemoryStorage()
      const activity = createTestActivity()
      const state = await TurnStateImpl.loadAsync(storage, activity)
      
      assert.throws(() => state.getValue('conversation.foo.bar'), /Invalid path/)
    })
  })

  describe('Dirty Tracking', () => {
    it('should save only changed scopes', async () => {
      const storage = new MemoryStorage()
      const activity = createTestActivity()
      
      await storage.write({
        'msteams/bot-456/conversations/conv-789': { count: 1 },
        'msteams/bot-456/users/user-123': { name: 'Alice' }
      })
      
      const state = await TurnStateImpl.loadAsync(storage, activity)
      state.conversation.set('count', 2)
      
      await state.saveAsync()
      
      const result = await storage.read([
        'msteams/bot-456/conversations/conv-789',
        'msteams/bot-456/users/user-123'
      ])
      
      assert.deepStrictEqual(result['msteams/bot-456/conversations/conv-789'], { count: 2 })
      assert.deepStrictEqual(result['msteams/bot-456/users/user-123'], { name: 'Alice' })
    })

    it('should not persist temp scope', async () => {
      const storage = new MemoryStorage()
      const activity = createTestActivity()
      
      const state = await TurnStateImpl.loadAsync(storage, activity)
      state.temp.set('tempKey', 'tempValue')
      
      await state.saveAsync()
      
      const state2 = await TurnStateImpl.loadAsync(storage, activity)
      assert.strictEqual(state2.temp.get('tempKey'), undefined)
    })
  })

  describe('Delete State', () => {
    it('should delete conversation state', async () => {
      const storage = new MemoryStorage()
      const activity = createTestActivity()
      
      await storage.write({
        'msteams/bot-456/conversations/conv-789': { count: 42 }
      })
      
      const state = await TurnStateImpl.loadAsync(storage, activity)
      state.deleteConversationState()
      
      await state.saveAsync()
      
      const result = await storage.read(['msteams/bot-456/conversations/conv-789'])
      assert.deepStrictEqual(result, {})
    })
  })
})
