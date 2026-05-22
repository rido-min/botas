// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Storage provider for reading/writing bot state.
 */
export interface Storage {
  /**
   * Read items from storage.
   * @param keys - Keys to read.
   * @returns Dictionary of key-value pairs that exist in storage.
   */
  read(keys: string[]): Promise<Record<string, unknown>>

  /**
   * Write items to storage.
   * @param changes - Dictionary of key-value pairs to write.
   */
  write(changes: Record<string, unknown>): Promise<void>

  /**
   * Delete items from storage.
   * @param keys - Keys to delete.
   */
  delete(keys: string[]): Promise<void>
}
