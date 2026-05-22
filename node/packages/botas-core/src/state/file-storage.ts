// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import type { Storage } from './storage.js'

/**
 * File-based storage implementation for simple persistence in single-instance deployments.
 *
 * Stores each key as a separate JSON file in the configured directory.
 * **Not suitable for multi-instance deployments** — no locking or concurrency protection.
 *
 * @example
 * ```ts
 * // Default directory: './bot-state'
 * const storage = new FileStorage()
 *
 * // Custom directory
 * const storage = new FileStorage('./data/state')
 * bot.useState(storage)
 * ```
 */
export class FileStorage implements Storage {
  private readonly rootDir: string

  /**
   * Create a new FileStorage instance.
   * @param rootDir - Root directory for state files. Defaults to './bot-state'.
   */
  constructor(rootDir: string = './bot-state') {
    this.rootDir = rootDir
  }

  /**
   * Read items from file storage.
   * @param keys - Keys to read.
   * @returns Dictionary of key-value pairs that exist in storage.
   */
  async read(keys: string[]): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {}
    
    await Promise.all(
      keys.map(async (key) => {
        const filePath = this.getFilePath(key)
        try {
          const content = await readFile(filePath, 'utf-8')
          result[key] = JSON.parse(content)
        } catch (err) {
          // File doesn't exist or invalid JSON - return nothing for this key
          // This matches the spec: "read() returns null/undefined when file missing"
        }
      })
    )

    return result
  }

  /**
   * Write items to file storage.
   * @param changes - Dictionary of key-value pairs to write.
   */
  async write(changes: Record<string, unknown>): Promise<void> {
    await Promise.all(
      Object.entries(changes).map(async ([key, value]) => {
        const filePath = this.getFilePath(key)
        const dir = dirname(filePath)
        
        // Create parent directories if needed
        await mkdir(dir, { recursive: true })
        
        // Write JSON to file
        const content = JSON.stringify(value, null, 2)
        await writeFile(filePath, content, 'utf-8')
      })
    )
  }

  /**
   * Delete items from file storage.
   * @param keys - Keys to delete.
   */
  async delete(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map(async (key) => {
        const filePath = this.getFilePath(key)
        try {
          await unlink(filePath)
        } catch (err) {
          // Idempotent - ignore if file doesn't exist (ENOENT)
        }
      })
    )
  }

  /**
   * Convert a storage key to a safe file path.
   * Uses encodeURIComponent to sanitize keys with separators or invalid chars.
   */
  private getFilePath(key: string): string {
    // Encode key to make it path-safe (matches .NET encoding for cross-language parity)
    const sanitized = encodeURIComponent(key)
    return join(this.rootDir, `${sanitized}.json`)
  }
}
