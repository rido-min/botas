// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { StateScope } from './state-scope.js'
import { StateScopeImpl } from './state-scope.js'
import type { CoreActivity } from '../core-activity.js'
import type { Storage } from './storage.js'

/**
 * State container for a single turn, providing scoped access to
 * conversation, user, and temporary state.
 *
 * @example
 * ```ts
 * bot.on('message', async (ctx) => {
 *   const count = ctx.state?.conversation.get<number>('count') ?? 0
 *   ctx.state?.conversation.set('count', count + 1)
 *   await ctx.send(`Turn ${count + 1}`)
 * })
 * ```
 */
export interface TurnState {
  /** Conversation-scoped state (persisted per conversation). */
  readonly conversation: StateScope

  /** User-scoped state (persisted per user across conversations). */
  readonly user: StateScope

  /** Temporary state for the current turn (not persisted). */
  readonly temp: StateScope

  /**
   * Get a value by path. Path format: "[scope].property" or "property" (defaults to temp).
   * @example
   * ```ts
   * ctx.state?.getValue<number>('conversation.count')
   * ctx.state?.getValue<string>('input')  // defaults to temp scope
   * ```
   */
  getValue<T = unknown>(path: string): T | undefined

  /**
   * Set a value by path. Path format: "[scope].property" or "property" (defaults to temp).
   * @example
   * ```ts
   * ctx.state?.setValue('conversation.count', 42)
   * ctx.state?.setValue('input', 'hello')  // defaults to temp scope
   * ```
   */
  setValue<T>(path: string, value: T): void

  /**
   * Check if a value exists at path.
   * @example
   * ```ts
   * if (ctx.state?.hasValue('conversation.count')) { ... }
   * ```
   */
  hasValue(path: string): boolean

  /**
   * Delete a value at path.
   * @example
   * ```ts
   * ctx.state?.deleteValue('conversation.count')
   * ```
   */
  deleteValue(path: string): void

  /** Delete all state in the conversation scope. */
  deleteConversationState(): void

  /** Delete all state in the user scope. */
  deleteUserState(): void

  /** Delete all state in the temp scope. */
  deleteTempState(): void
}

/**
 * Internal TurnState implementation.
 * @internal
 */
export class TurnStateImpl implements TurnState {
  readonly conversation: StateScopeImpl
  readonly user: StateScopeImpl
  readonly temp: StateScopeImpl

  private readonly conversationKey: string
  private readonly userKey: string
  private readonly storage: Storage

  private readonly initialConversationHash: string
  private readonly initialUserHash: string
  private conversationDeleted = false
  private userDeleted = false

  constructor(
    storage: Storage,
    conversationKey: string,
    userKey: string,
    conversationData: Record<string, unknown>,
    userData: Record<string, unknown>
  ) {
    this.storage = storage
    this.conversationKey = conversationKey
    this.userKey = userKey

    this.conversation = new StateScopeImpl(conversationData)
    this.user = new StateScopeImpl(userData)
    this.temp = new StateScopeImpl({})

    this.initialConversationHash = this.conversation.getHash()
    this.initialUserHash = this.user.getHash()
  }

  getValue<T = unknown>(path: string): T | undefined {
    const { scope, key } = this.parsePath(path)
    return scope.get<T>(key)
  }

  setValue<T>(path: string, value: T): void {
    const { scope, key } = this.parsePath(path)
    scope.set(key, value)
  }

  hasValue(path: string): boolean {
    const { scope, key } = this.parsePath(path)
    return scope.has(key)
  }

  deleteValue(path: string): void {
    const { scope, key } = this.parsePath(path)
    scope.delete(key)
  }

  deleteConversationState(): void {
    this.conversation.clear()
    this.conversationDeleted = true
  }

  deleteUserState(): void {
    this.user.clear()
    this.userDeleted = true
  }

  deleteTempState(): void {
    this.temp.clear()
  }

  /**
   * Save dirty state to storage.
   * Only writes scopes that have changed since load.
   * @internal
   */
  async saveAsync(): Promise<void> {
    const changes: Record<string, unknown> = {}
    const deletions: string[] = []

    // Check conversation scope
    if (this.conversationDeleted) {
      deletions.push(this.conversationKey)
    } else if (this.conversation.getHash() !== this.initialConversationHash) {
      changes[this.conversationKey] = this.conversation.getData()
    }

    // Check user scope
    if (this.userDeleted) {
      deletions.push(this.userKey)
    } else if (this.user.getHash() !== this.initialUserHash) {
      changes[this.userKey] = this.user.getData()
    }

    // Write and delete in parallel (per spec)
    const promises: Promise<void>[] = []
    if (Object.keys(changes).length > 0) {
      promises.push(this.storage.write(changes))
    }
    if (deletions.length > 0) {
      promises.push(this.storage.delete(deletions))
    }

    await Promise.all(promises)
  }

  /**
   * Parse a path string into scope and key.
   * Path format: "[scope].property" or "property" (defaults to temp).
   * Throws if path has more than one dot.
   */
  private parsePath(path: string): { scope: StateScopeImpl; key: string } {
    const parts = path.split('.')
    
    if (parts.length === 1) {
      // No scope prefix - default to temp
      return { scope: this.temp, key: path }
    }
    
    if (parts.length === 2) {
      const scopeName = parts[0]
      const key = parts[1]
      
      if (!scopeName || !key) {
        throw new Error(`Invalid path: "${path}" - scope and key cannot be empty`)
      }
      
      switch (scopeName.toLowerCase()) {
        case 'conversation':
          return { scope: this.conversation, key }
        case 'user':
          return { scope: this.user, key }
        case 'temp':
          return { scope: this.temp, key }
        default:
          throw new Error(`Invalid scope: "${scopeName}" - must be "conversation", "user", or "temp"`)
      }
    }
    
    throw new Error(`Invalid path: "${path}" - must be "[scope].key" or "key"`)
  }

  /**
   * Create a TurnState from an activity by deriving storage keys.
   * @internal
   */
  static async loadAsync(storage: Storage, activity: CoreActivity): Promise<TurnStateImpl> {
    const conversationKey = deriveConversationKey(activity)
    const userKey = deriveUserKey(activity)

    const results = await storage.read([conversationKey, userKey])
    
    const conversationData = (results[conversationKey] as Record<string, unknown>) ?? {}
    const userData = (results[userKey] as Record<string, unknown>) ?? {}

    return new TurnStateImpl(storage, conversationKey, userKey, conversationData, userData)
  }
}

/**
 * Derive the conversation scope storage key from an activity.
 * Key format: {channelId}/{botId}/conversations/{conversationId}
 * @internal
 */
export function deriveConversationKey(activity: CoreActivity): string {
  const channelId = activity.channelId
  const botId = activity.recipient?.id
  const conversationId = activity.conversation?.id

  if (!channelId || !botId || !conversationId) {
    throw new Error('Activity missing required fields for conversation key: channelId, recipient.id, conversation.id')
  }

  return `${channelId}/${botId}/conversations/${conversationId}`
}

/**
 * Derive the user scope storage key from an activity.
 * Key format: {channelId}/{botId}/users/{userId}
 * @internal
 */
export function deriveUserKey(activity: CoreActivity): string {
  const channelId = activity.channelId
  const botId = activity.recipient?.id
  const userId = activity.from?.id

  if (!channelId || !botId || !userId) {
    throw new Error('Activity missing required fields for user key: channelId, recipient.id, from.id')
  }

  return `${channelId}/${botId}/users/${userId}`
}
