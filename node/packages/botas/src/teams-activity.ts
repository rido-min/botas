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

  /** Copy routing fields from an incoming activity and swap from/recipient. */
  withConversationReference (source: CoreActivity): this {
    this._activity.serviceUrl = source.serviceUrl
    this._activity.conversation = source.conversation
    this._activity.from = source.recipient
    this._activity.recipient = source.from
    return this
  }

  /** Set the activity type (default is "message"). */
  withType (type: string): this {
    this._activity.type = type
    return this
  }

  /** Set the service URL. */
  withServiceUrl (serviceUrl: string): this {
    this._activity.serviceUrl = serviceUrl
    return this
  }

  /** Set the conversation. */
  withConversation (conversation: Conversation): this {
    this._activity.conversation = conversation
    return this
  }

  /** Set the sender account. */
  withFrom (from: ChannelAccount): this {
    this._activity.from = from
    return this
  }

  /** Set the recipient account. */
  withRecipient (recipient: ChannelAccount): this {
    this._activity.recipient = recipient
    return this
  }

  /** Set the text content. */
  withText (text: string): this {
    this._activity.text = text
    return this
  }

  /** Set the Teams-specific channel data. */
  withChannelData (channelData?: TeamsChannelData): this {
    this._activity.channelData = channelData
    return this
  }

  /** Set the suggested actions. */
  withSuggestedActions (suggestedActions?: SuggestedActions): this {
    this._activity.suggestedActions = suggestedActions
    return this
  }

  /** Replace the entities array. */
  withEntities (entities?: Entity[]): this {
    this._activity.entities = entities
    return this
  }

  /** Replace the attachments array. */
  withAttachments (attachments?: Attachment[]): this {
    this._activity.attachments = attachments
    return this
  }

  /** Set a single attachment (replaces the collection). */
  withAttachment (attachment: Attachment): this {
    this._activity.attachments = [attachment]
    return this
  }

  /** Append an entity to the collection. */
  addEntity (entity: Entity): this {
    this._activity.entities ??= []
    this._activity.entities.push(entity)
    return this
  }

  /** Append an attachment to the collection. */
  addAttachment (attachment: Attachment): this {
    this._activity.attachments ??= []
    this._activity.attachments.push(attachment)
    return this
  }

  /**
   * Creates a mention entity for the account and adds it to entities.
   * Does NOT modify the activity text — caller must include `<at>Name</at>` markup.
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
   * Parses JSON as an Adaptive Card and appends it as an attachment.
   * @throws {SyntaxError} If cardJson is not valid JSON.
   */
  addAdaptiveCardAttachment (cardJson: string): this {
    const content = JSON.parse(cardJson)
    this.addAttachment({
      contentType: 'application/vnd.microsoft.card.adaptive',
      content
    })
    return this
  }

  /**
   * Parses JSON as an Adaptive Card and sets it as the only attachment.
   * @throws {SyntaxError} If cardJson is not valid JSON.
   */
  withAdaptiveCardAttachment (cardJson: string): this {
    const content = JSON.parse(cardJson)
    this.withAttachment({
      contentType: 'application/vnd.microsoft.card.adaptive',
      content
    })
    return this
  }

  /** Return the constructed TeamsActivity. */
  build (): Partial<TeamsActivity> {
    return { ...this._activity }
  }
}
