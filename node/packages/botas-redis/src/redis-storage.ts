// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { createClient } from 'redis'
import type { RedisClientType } from 'redis'
import type { Storage } from 'botas-core'

/** Options for RedisStorage. */
export interface RedisStorageOptions {
  /** Prefix applied to every Redis key. Defaults to 'botas:'. */
  keyPrefix?: string
}

/** Options for RedisStorage when using an existing Redis client. */
export interface RedisStorageClientOptions extends RedisStorageOptions {
  /** Whether RedisStorage should close the provided client when close() is called. */
  ownsClient?: boolean
}

/**
 * Redis-backed storage implementation for distributed bot state.
 *
 * Stores each state item as a JSON-encoded Redis string using keys in the form
 * `<keyPrefix><raw_key>`. Operations use per-key GET/SET/DEL calls for Redis
 * Cluster compatibility.
 *
 * @example
 * ```ts
 * const storage = new RedisStorage('redis://localhost:6379')
 * bot.useState(storage)
 * ```
 */
export class RedisStorage implements Storage {
  private readonly client: RedisClientType
  private readonly keyPrefix: string
  private readonly ownsClient: boolean
  private connectPromise?: Promise<RedisClientType>

  /**
   * Create RedisStorage from a Redis URL. The client connects lazily on first use.
   * @param url - Redis connection URL, for example 'redis://localhost:6379'.
   * @param options - Storage options.
   */
  constructor (url: string, options?: RedisStorageOptions)

  /**
   * Create RedisStorage from an existing Redis client.
   * @param client - Redis client to use for storage operations.
   * @param options - Storage options.
   */
  constructor (client: RedisClientType, options?: RedisStorageClientOptions)

  constructor (redis: string | RedisClientType, options: RedisStorageOptions | RedisStorageClientOptions = {}) {
    this.client = typeof redis === 'string' ? createClient({ url: redis }) : redis
    this.keyPrefix = options.keyPrefix ?? 'botas:'
    this.ownsClient = typeof redis === 'string' || ('ownsClient' in options && options.ownsClient === true)
  }

  /**
   * Read items from Redis.
   * @param keys - Keys to read.
   * @returns Dictionary of key-value pairs that exist in storage.
   */
  async read (keys: string[]): Promise<Record<string, unknown>> {
    const client = await this.ensureConnected()
    const result: Record<string, unknown> = {}

    await Promise.all(
      keys.map(async key => {
        const value = await client.GET(this.getRedisKey(key))
        if (value !== null) {
          result[key] = JSON.parse(value)
        }
      })
    )

    return result
  }

  /**
   * Write items to Redis.
   * @param changes - Dictionary of key-value pairs to write.
   */
  async write (changes: Record<string, unknown>): Promise<void> {
    const client = await this.ensureConnected()

    await Promise.all(
      Object.entries(changes).map(async ([key, value]) => {
        await client.SET(this.getRedisKey(key), JSON.stringify(value))
      })
    )
  }

  /**
   * Delete items from Redis. Missing keys are ignored.
   * @param keys - Keys to delete.
   */
  async delete (keys: string[]): Promise<void> {
    const client = await this.ensureConnected()

    await Promise.all(
      keys.map(async key => {
        await client.DEL(this.getRedisKey(key))
      })
    )
  }

  /** Close the Redis client if this storage instance owns it. */
  async close (): Promise<void> {
    if (!this.ownsClient) {
      return
    }

    if (this.client.isOpen) {
      await this.client.quit()
    }

    this.connectPromise = undefined
  }

  private async ensureConnected (): Promise<RedisClientType> {
    if (this.client.isOpen) {
      return this.client
    }

    this.connectPromise ??= this.client.connect()
      .then(() => this.client)
      .catch((err: unknown) => {
        this.connectPromise = undefined
        throw err
      })

    return await this.connectPromise
  }

  private getRedisKey (key: string): string {
    return `${this.keyPrefix}${key}`
  }
}
