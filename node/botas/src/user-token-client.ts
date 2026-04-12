// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { BotHttpClient, type TokenProvider } from './bot-http-client.js'
import type { CoreActivity } from './core-activity.js'
import { getLogger } from './logger.js'

const TOKEN_SERVICE_URL = 'https://token.botframework.com'

/** The OAuth token status for a user on a specific connection. */
export interface TokenStatus {
  channelId: string;
  connectionName: string;
  hasToken: boolean;
  serviceProviderDisplayName?: string;
}

/** An OAuth token for a user. */
export interface UserToken {
  channelId: string;
  connectionName: string;
  token: string;
  expiration?: string;
  properties?: Record<string, unknown>;
}

/** Resource returned by the Bot Framework sign-in endpoint. */
export interface SignInResource {
  signInLink?: string;
  tokenExchangeResource?: TokenExchangeResource;
  tokenPostResource?: TokenPostResource;
}

/** Metadata for an SSO token exchange. */
export interface TokenExchangeResource {
  id: string;
  uri?: string;
  providerId?: string;
}

/** SAS URL for direct token posting. */
export interface TokenPostResource {
  sasUrl?: string;
}

/** Request body for exchanging an SSO token. */
export interface TokenExchangeRequest {
  uri?: string;
  token?: string;
}

/** A set of AAD resource URLs to fetch tokens for. */
export interface AadResourceUrls {
  resourceUrls: string[];
}

/**
 * Client for the Bot Framework token service.
 *
 * Provides methods for OAuth sign-in flows, token retrieval, SSO token
 * exchange, user sign-out, and AAD token acquisition.
 */
export class UserTokenClient {
  private readonly http: BotHttpClient

  constructor (getToken?: TokenProvider) {
    this.http = new BotHttpClient(getToken)
  }

  async getTokenStatusAsync (
    userId: string,
    channelId: string,
    connectionName?: string
  ): Promise<TokenStatus[]> {
    getLogger().info('Calling API endpoint: GetTokenStatus')
    const result = await this.http.get<TokenStatus[]>(
      TOKEN_SERVICE_URL,
      '/api/usertoken/GetTokenStatus',
      { userId, channelId, include: connectionName },
      { operationDescription: 'get token status' }
    )
    return result ?? []
  }

  async getTokenAsync (
    userId: string,
    channelId: string,
    connectionName: string,
    code?: string
  ): Promise<UserToken | undefined> {
    getLogger().info('Calling API endpoint: GetToken')
    return this.http.get<UserToken>(
      TOKEN_SERVICE_URL,
      '/api/usertoken/GetToken',
      { userId, channelId, connectionName, code },
      { operationDescription: 'get token', returnNullOnNotFound: true }
    )
  }

  async getSignInResourceAsync (
    connectionName: string,
    activity: CoreActivity,
    finalRedirect?: string
  ): Promise<SignInResource | undefined> {
    getLogger().info('Calling API endpoint: GetSignInResource')
    return this.http.get<SignInResource>(
      TOKEN_SERVICE_URL,
      '/api/botsignin/GetSignInResource',
      { state: buildStateParam(connectionName, activity), finalRedirect },
      { operationDescription: 'get sign-in resource' }
    )
  }

  async exchangeTokenAsync (
    userId: string,
    channelId: string,
    connectionName: string,
    request: TokenExchangeRequest
  ): Promise<UserToken | undefined> {
    getLogger().info('Calling API endpoint: ExchangeToken')
    const params = { userId, channelId, connectionName }
    const query = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
    const url = `${TOKEN_SERVICE_URL}/api/usertoken/ExchangeToken?${query}`
    return this.http.send<UserToken>('POST', url, request, {
      operationDescription: 'exchange token',
    })
  }

  async signOutUserAsync (
    userId: string,
    channelId: string,
    connectionName?: string
  ): Promise<void> {
    getLogger().info('Calling API endpoint: SignOut')
    await this.http.delete(
      TOKEN_SERVICE_URL,
      '/api/usertoken/SignOut',
      { userId, channelId, connectionName },
      { operationDescription: 'sign out user' }
    )
  }

  async getAadTokensAsync (
    userId: string,
    channelId: string,
    connectionName: string,
    resourceUrls: AadResourceUrls
  ): Promise<Record<string, UserToken>> {
    getLogger().info('Calling API endpoint: GetAadTokens')
    const params = { userId, channelId, connectionName }
    const query = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&')
    const url = `${TOKEN_SERVICE_URL}/api/usertoken/GetAadTokens?${query}`
    const result = await this.http.send<Record<string, UserToken>>(
      'POST',
      url,
      resourceUrls,
      { operationDescription: 'get AAD tokens' }
    )
    return result ?? {}
  }
}

function buildStateParam (connectionName: string, activity: CoreActivity): string {
  const ext = activity.properties ?? {}
  const state = {
    ConnectionName: connectionName,
    Conversation: {
      ActivityId: ext['id'],
      Bot: activity.recipient,
      ChannelId: ext['channelId'],
      Conversation: activity.conversation,
      ServiceUrl: activity.serviceUrl,
    },
    RelatesTo: null,
    MSAppId: activity.recipient?.id,
  }
  return Buffer.from(JSON.stringify(state)).toString('base64')
}
