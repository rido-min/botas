// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { CoreActivity, ChannelAccount, Conversation, Entity, Attachment } from './core-activity.js'
import type { SuggestedActions } from './suggested-actions.js'

/** Tenant information from Teams channel data. */
export interface TenantInfo {
  id?: string
  [key: string]: unknown
}

/** Channel information from Teams channel data. */
export interface ChannelInfo {
  id?: string
  name?: string
  [key: string]: unknown
}

/** Team information from Teams channel data. */
export interface TeamInfo {
  id?: string
  name?: string
  aadGroupId?: string
  [key: string]: unknown
}

/** Meeting information from Teams channel data. */
export interface MeetingInfo {
  id?: string
  [key: string]: unknown
}

/** Notification settings from Teams channel data. */
export interface NotificationInfo {
  alert?: boolean
  [key: string]: unknown
}

/** Teams-specific channel data attached to an activity. */
export interface TeamsChannelData {
  tenant?: TenantInfo
  channel?: ChannelInfo
  team?: TeamInfo
  meeting?: MeetingInfo
  notification?: NotificationInfo
  [key: string]: unknown
}

/** Teams-specific conversation with additional metadata. */
export interface TeamsConversation extends Conversation {
  conversationType?: string
  tenantId?: string
  isGroup?: boolean
  name?: string
}

/** A Teams-specific activity with strongly-typed channel data and helpers. */
export interface TeamsActivity extends CoreActivity {
  channelData?: TeamsChannelData
  timestamp?: string
  localTimestamp?: string
  locale?: string
  localTimezone?: string
  suggestedActions?: SuggestedActions
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const TeamsActivity = {
  /**
   * Creates a TeamsActivity from a CoreActivity.
   * Copies all fields and treats channelData as TeamsChannelData.
   *
   * @param activity - The source CoreActivity to convert.
   * @returns A shallow copy of the activity typed as {@link TeamsActivity}.
   * @throws {Error} If `activity` is falsy.
   */
  fromActivity (activity: CoreActivity): TeamsActivity {
    if (!activity) throw new Error('activity is required')
    return { ...activity } as TeamsActivity
  }
} as const

/**
 * Fluent builder for constructing outbound TeamsActivity instances.
 *
 * @example
 * ```ts
 * const reply = new TeamsActivityBuilder()
 *   .withConversationReference(incomingActivity)
 *   .withText('Hello!')
 *   .addMention(activity.from)
 *   .build()
 * ```
 */
export class TeamsActivityBuilder {
  private _activity: Partial<TeamsActivity> = { type: 'message', text: '' }

  /**
   * Copy routing fields from an incoming activity and swap from/recipient.
   *
   * @param source - The incoming activity to copy routing fields from.
   * @returns `this` for method chaining.
   */
  withConversationReference (source: CoreActivity): this {
    this._activity.serviceUrl = source.serviceUrl
    this._activity.conversation = source.conversation
    this._activity.from = source.recipient
    this._activity.recipient = source.from
    return this
  }

  /**
   * Set the activity type (default is "message").
   *
   * @param type - Activity type string.
   * @returns `this` for method chaining.
   */
  withType (type: string): this {
    this._activity.type = type
    return this
  }

  /**
   * Set the service URL.
   *
   * @param serviceUrl - Bot Framework service URL for the channel.
   * @returns `this` for method chaining.
   */
  withServiceUrl (serviceUrl: string): this {
    this._activity.serviceUrl = serviceUrl
    return this
  }

  /**
   * Set the conversation.
   *
   * @param conversation - Conversation reference.
   * @returns `this` for method chaining.
   */
  withConversation (conversation: Conversation): this {
    this._activity.conversation = conversation
    return this
  }

  /**
   * Set the sender account.
   *
   * @param from - Sender's channel account.
   * @returns `this` for method chaining.
   */
  withFrom (from: ChannelAccount): this {
    this._activity.from = from
    return this
  }

  /**
   * Set the recipient account.
   *
   * @param recipient - Recipient's channel account.
   * @returns `this` for method chaining.
   */
  withRecipient (recipient: ChannelAccount): this {
    this._activity.recipient = recipient
    return this
  }

  /**
   * Set the text content.
   *
   * @param text - Message text.
   * @returns `this` for method chaining.
   */
  withText (text: string): this {
    this._activity.text = text
    return this
  }

  /**
   * Set the Teams-specific channel data.
   *
   * @param channelData - Teams channel data (tenant, team, channel info, etc.).
   * @returns `this` for method chaining.
   */
  withChannelData (channelData?: TeamsChannelData): this {
    this._activity.channelData = channelData
    return this
  }

  /**
   * Set the suggested actions.
   *
   * @param suggestedActions - Quick-reply buttons to display below the message.
   * @returns `this` for method chaining.
   */
  withSuggestedActions (suggestedActions?: SuggestedActions): this {
    this._activity.suggestedActions = suggestedActions
    return this
  }

  /**
   * Replace the entities array.
   *
   * @param entities - New entities array, or `undefined` to clear.
   * @returns `this` for method chaining.
   */
  withEntities (entities?: Entity[]): this {
    this._activity.entities = entities
    return this
  }

  /**
   * Replace the attachments array.
   *
   * @param attachments - New attachments array, or `undefined` to clear.
   * @returns `this` for method chaining.
   */
  withAttachments (attachments?: Attachment[]): this {
    this._activity.attachments = attachments
    return this
  }

  /**
   * Set a single attachment (replaces the collection).
   *
   * @param attachment - The attachment to set.
   * @returns `this` for method chaining.
   */
  withAttachment (attachment: Attachment): this {
    this._activity.attachments = [attachment]
    return this
  }

  /**
   * Append an entity to the collection.
   *
   * @param entity - Entity to add.
   * @returns `this` for method chaining.
   */
  addEntity (entity: Entity): this {
    this._activity.entities ??= []
    this._activity.entities.push(entity)
    return this
  }

  /**
   * Append an attachment to the collection.
   *
   * @param attachment - Attachment to add.
   * @returns `this` for method chaining.
   */
  addAttachment (attachment: Attachment): this {
    this._activity.attachments ??= []
    this._activity.attachments.push(attachment)
    return this
  }

  /**
   * Creates a mention entity for the account and adds it to entities.
   * Does NOT modify the activity text — caller must include `<at>Name</at>` markup.
   *
   * @param account - The channel account to mention.
   * @param mentionText - Optional custom mention text; defaults to `<at>account.name</at>`.
   * @returns `this` for method chaining.
   * @throws {Error} If `account` is falsy.
   */
  addMention (account: ChannelAccount, mentionText?: string): this {
    if (!account) throw new Error('account is required')
    const text = mentionText ?? `<at>${account.name}</at>`
    this.addEntity({
      type: 'mention',
      mentioned: account,
      text
    })
    return this
  }

  /**
   * Parses JSON string or accepts a pre-parsed object as an Adaptive Card and appends it as an attachment.
   *
   * @param card - JSON string or pre-parsed Adaptive Card object.
   * @returns `this` for method chaining.
   * @throws {SyntaxError} If `card` is a string and not valid JSON.
   */
  addAdaptiveCardAttachment (card: string | Record<string, unknown>): this {
    const content = typeof card === 'string' ? JSON.parse(card) : structuredClone(card)
    this.addAttachment({
      contentType: 'application/vnd.microsoft.card.adaptive',
      content
    })
    return this
  }

  /**
   * Parses JSON string or accepts a pre-parsed object as an Adaptive Card and sets it as the only attachment.
   *
   * @param card - JSON string or pre-parsed Adaptive Card object.
   * @returns `this` for method chaining.
   * @throws {SyntaxError} If `card` is a string and not valid JSON.
   */
  withAdaptiveCardAttachment (card: string | Record<string, unknown>): this {
    const content = typeof card === 'string' ? JSON.parse(card) : structuredClone(card)
    this.withAttachment({
      contentType: 'application/vnd.microsoft.card.adaptive',
      content
    })
    return this
  }

  /**
   * Return the constructed TeamsActivity.
   *
   * @returns A shallow copy of the activity built so far.
   */
  build (): Partial<TeamsActivity> {
    return { ...this._activity }
  }
}
