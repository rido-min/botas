// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStorage } from './memory-storage.js'

describe('MemoryStorage', () => {
  it('should read empty result for missing keys', async () => {
    const storage = new MemoryStorage()
    const result = await storage.read(['missing-key'])
    assert.deepStrictEqual(result, {})
  })

  it('should write and read values', async () => {
    const storage = new MemoryStorage()
    await storage.write({ key1: { foo: 'bar' }, key2: 42 })
    
    const result = await storage.read(['key1', 'key2'])
    assert.deepStrictEqual(result, { key1: { foo: 'bar' }, key2: 42 })
  })

  it('should deep clone on write (prevent external mutation)', async () => {
    const storage = new MemoryStorage()
    const obj = { count: 1 }
    await storage.write({ key1: obj })
    
    // Mutate original
    obj.count = 999
    
    // Should not affect stored value
    const result = await storage.read(['key1'])
    assert.deepStrictEqual(result, { key1: { count: 1 } })
  })

  it('should deep clone on read (prevent external mutation)', async () => {
    const storage = new MemoryStorage()
    await storage.write({ key1: { count: 1 } })
    
    const result1 = await storage.read(['key1'])
    // Mutate returned object
    ;(result1['key1'] as { count: number }).count = 999
    
    // Should not affect stored value
    const result2 = await storage.read(['key1'])
    assert.deepStrictEqual(result2, { key1: { count: 1 } })
  })

  it('should delete keys', async () => {
    const storage = new MemoryStorage()
    await storage.write({ key1: 'value1', key2: 'value2' })
    
    await storage.delete(['key1'])
    
    const result = await storage.read(['key1', 'key2'])
    assert.deepStrictEqual(result, { key2: 'value2' })
  })

  it('should delete non-existent keys idempotently', async () => {
    const storage = new MemoryStorage()
    await storage.delete(['missing-key'])  // Should not throw
  })

  it('should overwrite existing keys', async () => {
    const storage = new MemoryStorage()
    await storage.write({ key1: 'old' })
    await storage.write({ key1: 'new' })
    
    const result = await storage.read(['key1'])
    assert.deepStrictEqual(result, { key1: 'new' })
  })
})
