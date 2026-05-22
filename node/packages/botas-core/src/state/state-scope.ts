// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * A key-value store for a single state scope (conversation, user, or temp).
 */
export interface StateScope {
  /**
   * Get a value by key.
   * @param key - The property key.
   * @returns The value, or undefined if not present.
   */
  get<T = unknown>(key: string): T | undefined

  /**
   * Set a value by key.
   * @param key - The property key.
   * @param value - The value to store.
   */
  set<T>(key: string, value: T): void

  /**
   * Check if a key exists.
   * @param key - The property key.
   * @returns True if the key exists.
   */
  has(key: string): boolean

  /**
   * Delete a value by key.
   * @param key - The property key.
   */
  delete(key: string): void

  /**
   * Clear all values in this scope.
   */
  clear(): void
}

/**
 * Internal implementation of StateScope.
 * @internal
 */
export class StateScopeImpl implements StateScope {
  private data: Record<string, unknown>

  constructor(initialData: Record<string, unknown> = {}) {
    this.data = initialData
  }

  get<T = unknown>(key: string): T | undefined {
    return this.data[key] as T | undefined
  }

  set<T>(key: string, value: T): void {
    this.data[key] = value
  }

  has(key: string): boolean {
    return key in this.data
  }

  delete(key: string): void {
    delete this.data[key]
  }

  clear(): void {
    this.data = {}
  }

  /**
   * Get the underlying data object for serialization.
   * @internal
   */
  getData(): Record<string, unknown> {
    return this.data
  }

  /**
   * Compute a hash for dirty tracking.
   * @internal
   */
  getHash(): string {
    return JSON.stringify(this.data)
  }
}
