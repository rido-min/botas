// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** Represents a user or bot account in a channel. */
export interface ChannelAccount {
  /** Unique identifier for the account. */
  id: string;
  /** Display name of the account. */
  name?: string;
  /** Azure Active Directory object ID. */
  aadObjectId?: string;
  /** Role of the entity (e.g. `"user"`, `"bot"`). */
  role?: string;
  /** Additional channel-specific properties. */
  properties?: Record<string, unknown>;
}

/** Teams-extended channel account with additional user properties. */
export interface TeamsChannelAccount extends ChannelAccount {
  /** User principal name (email). */
  userPrincipalName?: string;
  /** Email address. */
  email?: string;
}

/** Minimal conversation reference — only the ID is typed. */
export interface Conversation {
  /** Unique identifier for the conversation. */
  id: string;
  /** Additional channel-specific properties. */
  [key: string]: unknown;
}

/** An entity associated with an activity (e.g. a mention). */
export interface Entity {
  /** Entity type (e.g. `"mention"`, `"clientInfo"`). */
  type: string;
  [key: string]: unknown;
}

/** A file or card attachment on an activity. */
export interface Attachment {
  /** MIME type of the attachment content. */
  contentType: string;
  /** URL to retrieve the attachment content. */
  contentUrl?: string;
  /** Embedded content (e.g. an Adaptive Card JSON object). */
  content?: unknown;
  /** Filename or display name. */
  name?: string;
  /** URL to a thumbnail image. */
  thumbnailUrl?: string;
}

/**
 * The core activity payload received from or sent to the Bot Framework.
 * Only the fields listed here are explicitly typed; all other wire properties
 * are preserved in `properties`.
 */
export interface CoreActivity {
  /** Activity type (e.g. `"message"`, `"conversationUpdate"`). */
  type: string;
  /** Service URL for the sending channel — used to reply. */
  serviceUrl: string;
  /** Account that sent the activity. */
  from: ChannelAccount;
  /** Account that received the activity (the bot). */
  recipient: ChannelAccount;
  /** Conversation this activity belongs to. */
  conversation: Conversation;
  /** Text content of a message activity. */
  text?: string;
  /** Sub-type name for invoke activities (e.g. `"adaptiveCard/action"`, `"task/fetch"`). */
  name?: string;
  /** Payload for invoke activities. */
  value?: unknown;
  /** Structured entities attached to the activity. */
  entities?: Entity[];
  /** File or card attachments. */
  attachments?: Attachment[];
  /** Additional properties not covered by the typed fields above. */
  properties?: Record<string, unknown>;
}

/** Response returned after creating or sending an activity. */
export interface ResourceResponse {
  /** ID of the created resource. */
  id: string;
}

/** Response returned after creating a new conversation. */
export interface ConversationResourceResponse extends ResourceResponse {
  /** Service URL for the new conversation. */
  serviceUrl: string;
  /** ID of the activity that bootstrapped the conversation. */
  activityId: string;
}

/** A page of members with an optional continuation token for subsequent pages. */
export interface PagedMembersResult<T> {
  /** Members on this page. */
  members: T[];
  /** Opaque token to pass on the next call to retrieve the following page. */
  continuationToken?: string;
}

/** Parameters used to create a new conversation. */
export interface ConversationParameters {
  /** Whether to create a group conversation. */
  isGroup?: boolean;
  /** Bot account to include in the conversation. */
  bot?: ChannelAccount;
  /** Initial member list. */
  members?: ChannelAccount[];
  /** Optional topic name. */
  topicName?: string;
  /** Tenant ID. */
  tenantId?: string;
  /** Initial activity to post when the conversation is created. */
  activity?: Partial<CoreActivity>;
  /** Channel-specific data. */
  channelData?: unknown;
}

/** A page of conversations with an optional continuation token. */
export interface ConversationsResult {
  /** Conversations on this page. */
  conversations: Conversation[];
  /** Opaque token to pass on the next call to retrieve the following page. */
  continuationToken?: string;
}

/** A transcript (ordered list of activities) for a conversation. */
export interface Transcript {
  /** Activities in the transcript, ordered by timestamp. */
  activities: CoreActivity[];
}

/**
 * Fluent builder for constructing outbound activities.
 *
 * @example
 * ```ts
 * const reply = new CoreActivityBuilder()
 *   .withConversationReference(incomingActivity)
 *   .withText('Hello!')
 *   .build()
 * ```
 */
export class CoreActivityBuilder {
  private _activity: Partial<CoreActivity> = { type: 'message', text: '' }

  /**
   * Copy routing fields from an incoming activity and swap from/recipient.
   * Sets `serviceUrl`, `conversation`, `from` (← source recipient),
   * and `recipient` (← source from).
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
   * Set the activity type (default is `"message"`).
   *
   * @param type - Activity type string.
   * @returns `this` for method chaining.
   */
  withType (type: string): this {
    this._activity.type = type
    return this
  }

  /**
   * Set the service URL for the channel.
   *
   * @param serviceUrl - Bot Framework service URL.
   * @returns `this` for method chaining.
   */
  withServiceUrl (serviceUrl: string): this {
    this._activity.serviceUrl = serviceUrl
    return this
  }

  /**
   * Set the conversation reference.
   *
   * @param conversation - Conversation to target.
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
   * Set the text content of the activity.
   *
   * @param text - Message text.
   * @returns `this` for method chaining.
   */
  withText (text: string): this {
    this._activity.text = text
    return this
  }

  /**
   * Set the entities array.
   *
   * @param entities - Entities to attach.
   * @returns `this` for method chaining.
   */
  withEntities (entities: Entity[]): this {
    this._activity.entities = entities
    return this
  }

  /**
   * Set the attachments array.
   *
   * @param attachments - Attachments to include.
   * @returns `this` for method chaining.
   */
  withAttachments (attachments: Attachment[]): this {
    this._activity.attachments = attachments
    return this
  }

  /**
   * Return a shallow copy of the constructed activity.
   *
   * @returns The built activity as a partial CoreActivity.
   */
  build (): Partial<CoreActivity> {
    return { ...this._activity }
  }
}
