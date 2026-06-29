// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { _BotHttpClient, type TokenProvider } from './bot-http-client.js'
import { getLogger } from './logger.js'
import { getTracer } from './tracer-provider.js'
import { getMetrics } from './meter-provider.js'
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
 * Client for the Bot Service v3 Conversations REST API.
 *
 * Sends activities, manages members, creates conversations, and uploads attachments.
 */
export class ConversationClient {
  private readonly http: _BotHttpClient

  /**
   * Create a new ConversationClient.
   *
   * @param getToken - Optional token provider for authenticating outbound API calls.
   *   Omit for unauthenticated local development.
   */
  constructor (getToken?: TokenProvider) {
    this.http = new _BotHttpClient(getToken)
  }

  /**
   * Send an activity to a conversation.
   *
   * @param serviceUrl - Bot Service service URL (from the incoming activity).
   * @param conversationId - Target conversation ID.
   * @param activity - CoreActivity payload to send.
   * @returns The {@link ResourceResponse} containing the new activity ID, or `undefined`.
   */
  async sendCoreActivityAsync (
    serviceUrl: string,
    conversationId: string,
    activity: Partial<CoreActivity>
  ): Promise<ResourceResponse | undefined> {
    const tracer = getTracer()
    const ccSpan = tracer?.startSpan('botas.conversation_client')
    ccSpan?.setAttribute('conversation.id', conversationId)
    ccSpan?.setAttribute('activity.type', (activity as CoreActivity).type ?? '')
    ccSpan?.setAttribute('service.url', serviceUrl)

    const metrics = getMetrics()
    metrics?.outboundApiCalls.add(1, { operation: 'sendActivity' })

    try {
      const endpoint = `/v3/conversations/${encodeConversationId(conversationId)}/activities`
      getLogger().trace('Sending activity to %s%s', serviceUrl, endpoint)
      const result = await this.http.post<ResourceResponse>(
        serviceUrl,
        endpoint,
        activity,
        { operationDescription: 'send activity' }
      )
      ccSpan?.setAttribute('activity.id', result?.id ?? '')
      return result
    } catch (err) {
      ccSpan?.recordException(err instanceof Error ? err : new Error(String(err)))
      metrics?.outboundApiErrors.add(1, { operation: 'sendActivity' })
      throw err
    } finally {
      ccSpan?.end()
    }
  }

  /**
   * Update an existing activity in a conversation.
   *
   * @param serviceUrl - Bot Service service URL.
   * @param conversationId - Target conversation ID.
   * @param activityId - ID of the activity to update.
   * @param activity - Updated activity payload (partial merge).
   * @returns The {@link ResourceResponse}, or `undefined`.
   */
  async updateCoreActivityAsync (
    serviceUrl: string,
    conversationId: string,
    activityId: string,
    activity: Partial<CoreActivity>
  ): Promise<ResourceResponse | undefined> {
    const metrics = getMetrics()
    metrics?.outboundApiCalls.add(1, { operation: 'updateActivity' })
    const endpoint = `/v3/conversations/${encodeConversationId(conversationId)}/activities/${activityId}`
    getLogger().trace('Updating activity at %s%s', serviceUrl, endpoint)
    try {
      return await this.http.put<ResourceResponse>(
        serviceUrl,
        endpoint,
        activity,
        { operationDescription: 'update activity' }
      )
    } catch (err) {
      metrics?.outboundApiErrors.add(1, { operation: 'updateActivity' })
      throw err
    }
  }

  /**
   * Delete an activity from a conversation.
   *
   * @param serviceUrl - Bot Service service URL.
   * @param conversationId - Target conversation ID.
   * @param activityId - ID of the activity to delete.
   */
  async deleteCoreActivityAsync (
    serviceUrl: string,
    conversationId: string,
    activityId: string
  ): Promise<void> {
    const metrics = getMetrics()
    metrics?.outboundApiCalls.add(1, { operation: 'deleteActivity' })
    const endpoint = `/v3/conversations/${encodeConversationId(conversationId)}/activities/${activityId}`
    getLogger().trace('Deleting activity at %s%s', serviceUrl, endpoint)
    try {
      await this.http.delete(
        serviceUrl,
        endpoint,
        undefined,
        { operationDescription: 'delete activity' }
      )
    } catch (err) {
      metrics?.outboundApiErrors.add(1, { operation: 'deleteActivity' })
      throw err
    }
  }

  /**
   * Retrieve all members of a conversation.
   *
   * @param serviceUrl - Bot Service service URL.
   * @param conversationId - Target conversation ID.
   * @returns Array of {@link ChannelAccount} members; empty array if none.
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
   *
   * @param serviceUrl - Bot Service service URL.
   * @param conversationId - Target conversation ID.
   * @param memberId - ID of the member to retrieve.
   * @returns The {@link ChannelAccount}, or `undefined` if not found.
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
   *
   * Use `continuationToken` from the previous result to fetch subsequent pages.
   *
   * @param serviceUrl - Bot Service service URL.
   * @param conversationId - Target conversation ID.
   * @param pageSize - Maximum number of members per page.
   * @param continuationToken - Opaque token from a previous page result.
   * @returns A {@link PagedMembersResult} with members and an optional continuation token.
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
   *
   * @param serviceUrl - Bot Service service URL.
   * @param conversationId - Target conversation ID.
   * @param memberId - ID of the member to remove.
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
   *
   * @param serviceUrl - Bot Service service URL.
   * @param parameters - Conversation creation parameters (members, topic, initial activity).
   * @returns A {@link ConversationResourceResponse} with the new conversation ID, or `undefined`.
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
   *
   * @param serviceUrl - Bot Service service URL.
   * @param continuationToken - Opaque token from a previous page result.
   * @returns A {@link ConversationsResult} with conversations and an optional continuation token.
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
   *
   * @param serviceUrl - Bot Service service URL.
   * @param conversationId - Target conversation ID.
   * @param transcript - Ordered list of activities to upload.
   * @returns The {@link ResourceResponse}, or `undefined`.
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
   *
   * @param serviceUrl - Bot Service service URL.
   * @param conversationId - Target conversation ID.
   * @returns The {@link Conversation}, or `undefined` if not found.
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
  return encodeURIComponent(conversationId)
}
