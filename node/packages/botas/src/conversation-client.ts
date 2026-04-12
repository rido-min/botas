// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BotHttpClient, type TokenProvider } from './bot-http-client.js'
import { getLogger } from './logger.js'
import type {
  CoreActivity,
  ChannelAccount,
  Conversation,
  ConversationParameters,
  ConversationResourceResponse,
  ConversationsResult,
  PagedMembersResult,
  ResourceResponse,
  Transcript,
} from './core-activity.js'

/**
 * Client for the Bot Framework v3 Conversations REST API.
 *
 * Sends activities, manages members, creates conversations, and uploads attachments.
 */
export class ConversationClient {
  private readonly http: BotHttpClient

  constructor (getToken?: TokenProvider) {
    this.http = new BotHttpClient(getToken)
  }

  /**
   * Send an activity to a conversation.
   *
   * @param serviceUrl - Bot Framework service URL (from the incoming activity).
   * @param conversationId - Target conversation ID.
   * @param activity - CoreActivity payload to send.
   */
  async sendCoreActivityAsync (
    serviceUrl: string,
    conversationId: string,
    activity: Partial<CoreActivity>
  ): Promise<ResourceResponse | undefined> {
    const endpoint = `/v3/conversations/${encodeConversationId(conversationId)}/activities`
    getLogger().trace('Sending activity to %s%s', serviceUrl, endpoint)
    return this.http.post<ResourceResponse>(
      serviceUrl,
      endpoint,
      activity,
      { operationDescription: 'send activity' }
    )
  }

  /**
   * Update an existing activity in a conversation.
   */
  async updateCoreActivityAsync (
    serviceUrl: string,
    conversationId: string,
    activityId: string,
    activity: Partial<CoreActivity>
  ): Promise<ResourceResponse | undefined> {
    const endpoint = `/v3/conversations/${encodeConversationId(conversationId)}/activities/${activityId}`
    getLogger().trace('Updating activity at %s%s', serviceUrl, endpoint)
    return this.http.put<ResourceResponse>(
      serviceUrl,
      endpoint,
      activity,
      { operationDescription: 'update activity' }
    )
  }

  /**
   * Delete an activity from a conversation.
   */
  async deleteCoreActivityAsync (
    serviceUrl: string,
    conversationId: string,
    activityId: string
  ): Promise<void> {
    const endpoint = `/v3/conversations/${encodeConversationId(conversationId)}/activities/${activityId}`
    getLogger().trace('Deleting activity at %s%s', serviceUrl, endpoint)
    await this.http.delete(
      serviceUrl,
      endpoint,
      undefined,
      { operationDescription: 'delete activity' }
    )
  }

  /**
   * Retrieve all members of a conversation.
   */
  async getConversationMembersAsync (
    serviceUrl: string,
    conversationId: string
  ): Promise<ChannelAccount[]> {
    const endpoint = `/v3/conversations/${encodeConversationId(conversationId)}/members`
    getLogger().trace('Getting conversation members from %s%s', serviceUrl, endpoint)
    const result = await this.http.get<ChannelAccount[]>(
      serviceUrl,
      endpoint,
      undefined,
      { operationDescription: 'get conversation members' }
    )
    return result ?? []
  }

  /**
   * Retrieve a single member of a conversation by user ID.
   */
  async getConversationMemberAsync (
    serviceUrl: string,
    conversationId: string,
    memberId: string
  ): Promise<ChannelAccount | undefined> {
    const endpoint = `/v3/conversations/${encodeConversationId(conversationId)}/members/${memberId}`
    getLogger().trace('Getting conversation member from %s%s', serviceUrl, endpoint)
    return this.http.get<ChannelAccount>(
      serviceUrl,
      endpoint,
      undefined,
      { operationDescription: 'get conversation member', returnNullOnNotFound: true }
    )
  }

  /**
   * Retrieve a page of conversation members.
   */
  async getConversationPagedMembersAsync (
    serviceUrl: string,
    conversationId: string,
    pageSize?: number,
    continuationToken?: string
  ): Promise<PagedMembersResult<ChannelAccount>> {
    const endpoint = `/v3/conversations/${encodeConversationId(conversationId)}/pagedmembers`
    getLogger().trace('Getting paged conversation members from %s%s', serviceUrl, endpoint)
    const params: Record<string, string | undefined> = {
      pageSize: pageSize?.toString(),
      continuationToken,
    }
    const result = await this.http.get<PagedMembersResult<ChannelAccount>>(
      serviceUrl,
      endpoint,
      params,
      { operationDescription: 'get paged members' }
    )
    return result ?? { members: [] }
  }

  /**
   * Remove a member from a conversation.
   */
  async deleteConversationMemberAsync (
    serviceUrl: string,
    conversationId: string,
    memberId: string
  ): Promise<void> {
    const endpoint = `/v3/conversations/${encodeConversationId(conversationId)}/members/${memberId}`
    getLogger().trace('Deleting conversation member at %s%s', serviceUrl, endpoint)
    await this.http.delete(
      serviceUrl,
      endpoint,
      undefined,
      { operationDescription: 'delete conversation member' }
    )
  }

  /**
   * Create a new proactive conversation.
   */
  async createConversationAsync (
    serviceUrl: string,
    parameters: ConversationParameters
  ): Promise<ConversationResourceResponse | undefined> {
    getLogger().trace('Creating conversation at %s', serviceUrl)
    return this.http.post<ConversationResourceResponse>(
      serviceUrl,
      '/v3/conversations',
      parameters,
      { operationDescription: 'create conversation' }
    )
  }

  /**
   * List all conversations the bot is a member of.
   */
  async getConversationsAsync (
    serviceUrl: string,
    continuationToken?: string
  ): Promise<ConversationsResult> {
    getLogger().trace('Getting conversations from %s', serviceUrl)
    const result = await this.http.get<ConversationsResult>(
      serviceUrl,
      '/v3/conversations',
      { continuationToken },
      { operationDescription: 'get conversations' }
    )
    return result ?? { conversations: [] }
  }

  /**
   * Upload a transcript of past activities to a conversation.
   */
  async sendConversationHistoryAsync (
    serviceUrl: string,
    conversationId: string,
    transcript: Transcript
  ): Promise<ResourceResponse | undefined> {
    const endpoint = `/v3/conversations/${encodeConversationId(conversationId)}/activities/history`
    getLogger().trace('Sending conversation history to %s%s', serviceUrl, endpoint)
    return this.http.post<ResourceResponse>(
      serviceUrl,
      endpoint,
      transcript,
      { operationDescription: 'send conversation history' }
    )
  }

  /**
   * Retrieve the conversation account details.
   */
  async getConversationAsync (
    serviceUrl: string,
    conversationId: string
  ): Promise<Conversation | undefined> {
    const endpoint = `/v3/conversations/${encodeConversationId(conversationId)}`
    getLogger().trace('Getting conversation account from %s%s', serviceUrl, endpoint)
    return this.http.get<Conversation>(
      serviceUrl,
      endpoint,
      undefined,
      { operationDescription: 'get conversation', returnNullOnNotFound: true }
    )
  }
}

function encodeConversationId (conversationId: string): string {
  const truncated = conversationId.split(';')[0]
  if (truncated !== conversationId) {
    getLogger().info("Truncating conversation ID for 'agents' channel")
  }
  return encodeURIComponent(truncated)
}
