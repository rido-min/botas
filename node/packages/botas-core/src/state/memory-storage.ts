// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { Storage } from './storage.js'

/**
 * In-memory storage implementation for development and testing.
 *
 * Thread-safe for concurrent access within a single process. Data is lost when the process exits.
 *
 * @example
 * ```ts
 * const storage = new MemoryStorage()
 * bot.useState(storage)
 * ```
 */
export class MemoryStorage implements Storage {
  private readonly store = new Map<string, unknown>()

  /**
   * Read items from memory.
   * @param keys - Keys to read.
   * @returns Dictionary of key-value pairs that exist in storage.
   */
  async read(keys: string[]): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {}
    for (const key of keys) {
      const value = this.store.get(key)
      if (value !== undefined) {
        // Deep clone to prevent external mutation
        result[key] = JSON.parse(JSON.stringify(value))
      }
    }
    return result
  }

  /**
   * Write items to memory.
   * @param changes - Dictionary of key-value pairs to write.
   */
  async write(changes: Record<string, unknown>): Promise<void> {
    for (const [key, value] of Object.entries(changes)) {
      // Deep clone to prevent external mutation
      this.store.set(key, JSON.parse(JSON.stringify(value)))
    }
  }

  /**
   * Delete items from memory.
   * @param keys - Keys to delete.
   */
  async delete(keys: string[]): Promise<void> {
    for (const key of keys) {
      this.store.delete(key)
    }
  }
}
