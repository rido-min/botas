// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { randomUUID } from 'node:crypto'
import { describe, it, test } from 'node:test'
import assert from 'node:assert/strict'
import type { RedisClientType } from 'redis'
import { RedisStorage } from './redis-storage.js'

// Test-only — implements only methods used by RedisStorage.
class FakeRedisClient {
  readonly store = new Map<string, string>()
  readonly commands: Array<{ command: 'GET' | 'SET' | 'DEL', key: string }> = []
  isOpen = false
  connectCalls = 0
  quitCalls = 0

  async connect (): Promise<FakeRedisClient> {
    this.isOpen = true
    this.connectCalls += 1
    return this
  }

  async GET (key: string): Promise<string | null> {
    this.commands.push({ command: 'GET', key })
    return this.store.get(key) ?? null
  }

  async SET (key: string, value: string): Promise<'OK'> {
    this.commands.push({ command: 'SET', key })
    this.store.set(key, value)
    return 'OK'
  }

  async DEL (key: string): Promise<number> {
    this.commands.push({ command: 'DEL', key })
    const existed = this.store.delete(key)
    return existed ? 1 : 0
  }

  async quit (): Promise<'OK'> {
    if (this.isOpen) {
      this.isOpen = false
      this.quitCalls += 1
    }
    return 'OK'
  }

  rawGet (key: string): string | null {
    return this.store.get(key) ?? null
  }

  asRedisClient (): RedisClientType {
    return this as unknown as RedisClientType
  }
}

interface StorageFixture {
  storage: RedisStorage
  fake?: FakeRedisClient
}

interface StorageCase {
  name: string
  keyPrefix?: string
  run: (fixture: StorageFixture) => Promise<void>
}

const storageCases: StorageCase[] = [
  {
    name: 'omits missing keys',
    run: async ({ storage }) => {
      const result = await storage.read(['missing-key'])
      assert.deepStrictEqual(result, {})
    }
  },
  {
    name: 'writes and reads JSON values',
    run: async ({ storage }) => {
      const data = { key1: { foo: 'bar' }, key2: 42 }
      await storage.write(data)

      const result = await storage.read(['key1', 'key2'])
      assert.deepStrictEqual(result, data)

      await storage.delete(Object.keys(data))
    }
  },
  {
    name: 'deletes idempotently',
    run: async ({ storage }) => {
      await storage.write({ key1: 'value1', key2: 'value2' })
      await storage.delete(['key1', 'missing-key'])
      await storage.delete(['key1', 'missing-key'])

      const result = await storage.read(['key1', 'key2'])
      assert.deepStrictEqual(result, { key2: 'value2' })

      await storage.delete(['key2'])
    }
  },
  {
    name: 'applies the configured key prefix',
    keyPrefix: 'custom:',
    run: async ({ storage, fake }) => {
      await storage.write({ state: 'value' })
      const result = await storage.read(['state'])
      await storage.delete(['state'])

      assert.deepStrictEqual(result, { state: 'value' })

      if (fake !== undefined) {
        assert.equal(fake.rawGet('state'), null)
        assert.deepStrictEqual(fake.commands.map(command => command.key), [
          'custom:state',
          'custom:state',
          'custom:state'
        ])
      }
    }
  },
  {
    name: 'round-trips keys with special characters',
    run: async ({ storage }) => {
      const key = 'msteams/botId/conversations/19:meeting id/%/🤖'
      const data = { [key]: { value: 'test' } }
      await storage.write(data)

      const result = await storage.read([key])
      assert.deepStrictEqual(result, data)

      await storage.delete([key])
    }
  },
  {
    name: 'preserves empty objects',
    run: async ({ storage }) => {
      const data = { empty: {} }
      await storage.write(data)

      const result = await storage.read(['empty'])
      assert.deepStrictEqual(result, data)

      await storage.delete(['empty'])
    }
  },
  {
    name: 'preserves nested objects and arrays',
    run: async ({ storage }) => {
      const data = {
        nested: {
          child: {
            values: [1, 'two', true, { deep: 'value' }]
          }
        }
      }
      await storage.write(data)

      const result = await storage.read(['nested'])
      assert.deepStrictEqual(result, data)

      await storage.delete(['nested'])
    }
  },
  {
    name: 'preserves null values inside state',
    run: async ({ storage }) => {
      const data = {
        key1: {
          value: null,
          nested: { alsoNull: null },
          array: [null, { child: null }]
        }
      }
      await storage.write(data)

      const result = await storage.read(['key1'])
      assert.deepStrictEqual(result, data)

      await storage.delete(['key1'])
    }
  },
  {
    name: 'closes idempotently',
    run: async ({ storage, fake }) => {
      await storage.write({ closeKey: 'value' })
      await storage.delete(['closeKey'])
      await storage.close()
      await storage.close()

      if (fake !== undefined) {
        assert.equal(fake.quitCalls, 1)
      }
    }
  }
]

describe('RedisStorage', () => {
  for (const storageCase of storageCases) {
    it(storageCase.name, async () => {
      const fake = new FakeRedisClient()
      const storage = new RedisStorage(fake.asRedisClient(), {
        keyPrefix: storageCase.keyPrefix,
        ownsClient: true
      })

      try {
        await storageCase.run({ storage, fake })
      } finally {
        await storage.close()
      }
    })
  }
})

test('RedisStorage integration contract', { skip: !process.env.REDIS_URL }, async () => {
  const redisUrl = process.env.REDIS_URL
  assert.ok(redisUrl)

  for (const storageCase of storageCases) {
    const storage = new RedisStorage(redisUrl, {
      keyPrefix: storageCase.keyPrefix ?? `botas-test:${randomUUID()}:`
    })

    try {
      await storageCase.run({ storage })
    } finally {
      await storage.close()
    }
  }
})
