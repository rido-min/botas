// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { rmdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { FileStorage } from './file-storage.js'

describe('FileStorage', () => {
  const testDir = './test-bot-state'

  beforeEach(async () => {
    if (existsSync(testDir)) {
      await rmdir(testDir, { recursive: true })
    }
  })

  afterEach(async () => {
    if (existsSync(testDir)) {
      await rmdir(testDir, { recursive: true })
    }
  })

  it('should read empty result for missing files', async () => {
    const storage = new FileStorage(testDir)
    const result = await storage.read(['missing-key'])
    assert.deepStrictEqual(result, {})
  })

  it('should write and read values', async () => {
    const storage = new FileStorage(testDir)
    await storage.write({ key1: { foo: 'bar' }, key2: 42 })
    
    const result = await storage.read(['key1', 'key2'])
    assert.deepStrictEqual(result, { key1: { foo: 'bar' }, key2: 42 })
  })

  it('should create parent directories if needed', async () => {
    const storage = new FileStorage(testDir)
    await storage.write({ 'test-key': { value: 'test' } })
    
    const result = await storage.read(['test-key'])
    assert.deepStrictEqual(result, { 'test-key': { value: 'test' } })
  })

  it('should delete files', async () => {
    const storage = new FileStorage(testDir)
    await storage.write({ key1: 'value1', key2: 'value2' })
    
    await storage.delete(['key1'])
    
    const result = await storage.read(['key1', 'key2'])
    assert.deepStrictEqual(result, { key2: 'value2' })
  })

  it('should delete non-existent files idempotently', async () => {
    const storage = new FileStorage(testDir)
    await storage.delete(['missing-key'])  // Should not throw
  })

  it('should sanitize keys with special characters', async () => {
    const storage = new FileStorage(testDir)
    const key = 'msteams/botId/conversations/19:meeting-id@thread.v2'
    await storage.write({ [key]: { value: 'test' } })
    
    const result = await storage.read([key])
    assert.deepStrictEqual(result, { [key]: { value: 'test' } })
  })

  it('should preserve unknown JSON properties on round-trip', async () => {
    const storage = new FileStorage(testDir)
    const data = {
      key1: {
        knownProp: 'value',
        unknownProp: 'should-be-preserved',
        nested: { deep: { value: 123 } }
      }
    }
    
    await storage.write(data)
    const result = await storage.read(['key1'])
    
    assert.deepStrictEqual(result, data)
  })
})
