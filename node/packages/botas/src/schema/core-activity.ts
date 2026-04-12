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
 * Create a reply activity from an incoming activity (FR-005).
 *
 * Copies `conversation` and `serviceUrl` from the original and swaps
 * `from`/`recipient`.
 *
 * @param activity - The incoming activity to reply to.
 * @param text - Optional text content for the reply.
 */
export function createReplyActivity (activity: CoreActivity, text = ''): Partial<CoreActivity> {
  return {
    type: 'message',
    serviceUrl: activity.serviceUrl,
    conversation: activity.conversation,
    from: activity.recipient,
    recipient: activity.from,
    text,
  }
}
