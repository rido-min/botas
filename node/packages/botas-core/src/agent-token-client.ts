// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import axios from 'axios'
import { getLogger } from './logger.js'

const FMI_EXCHANGE_SCOPE = 'api://AzureADTokenExchange/.default'
const JWT_BEARER_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'

/**
 * Value object representing agentic identity fields from a Conversation.
 * When present, indicates outbound calls should use the agentic token flow.
 */
export interface AgenticIdentity {
  /** The Agent Identity's application ID (dual-purpose: fmi_path in step 1, client_id in steps 2–3). */
  agenticAppId: string
  /** The user OID the agent is acting as. */
  agenticUserId: string
  /** The Blueprint's application ID. */
  agenticAppBlueprintId?: string
}

/**
 * Extracts an AgenticIdentity from a conversation object if agentic fields are present.
 *
 * @param conversation - The conversation to inspect.
 * @returns An AgenticIdentity, or undefined if required fields are missing.
 */
export function getAgenticIdentity (conversation?: { agenticAppId?: string; agenticUserId?: string; agenticAppBlueprintId?: string }): AgenticIdentity | undefined {
  if (!conversation?.agenticAppId || !conversation?.agenticUserId) {
    return undefined
  }
  return {
    agenticAppId: conversation.agenticAppId,
    agenticUserId: conversation.agenticUserId,
    agenticAppBlueprintId: conversation.agenticAppBlueprintId,
  }
}

interface CachedToken {
  accessToken: string
  expiresAt: number
}

/**
 * Acquires user-delegated tokens via the Entra Agent ID 3-step token exchange flow.
 * Uses raw HTTP calls — no MSAL dependency — for structural parity with .NET and Python.
 *
 * The flow is documented at:
 * https://learn.microsoft.com/en-us/entra/agent-id/identity-platform/agent-user-oauth-flow
 *
 * Step 1 — Blueprint acquires FMI exchange token (T1) using fmi_path.
 * Step 2 — Agent Identity acquires impersonation token (T2) using T1 as client_assertion.
 * Step 3 — Agent Identity acquires resource token via user_fic grant with T1 + T2.
 */
export class AgentTokenClient {
  private readonly tokenEndpoint: string
  private readonly cache = new Map<string, CachedToken>()

  /**
   * Create a new AgentTokenClient.
   *
   * @param tenantId - Azure AD tenant ID.
   * @param clientId - Blueprint application (client) ID.
   * @param clientSecret - Blueprint client secret.
   */
  constructor (
    tenantId: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {
    this.tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  }

  /**
   * Acquires a Bearer token for an agent acting as a specific user.
   * Implements the 3-step agent user identity (user_fic) flow with built-in caching.
   *
   * @param agentIdentityId - The Agent Identity ID (dual-purpose: fmi_path in step 1, client_id in steps 2–3).
   * @param agentUserOid - The user OID to impersonate.
   * @param scope - Target resource scope (e.g. `https://api.botframework.com/.default`).
   * @returns A string in the format `"Bearer {token}"`.
   */
  async getAgentUserToken (agentIdentityId: string, agentUserOid: string, scope: string): Promise<string> {
    const cacheKey = `${agentIdentityId}:${agentUserOid}:${scope}`
    const cached = this.cache.get(cacheKey)

    if (cached && Date.now() < cached.expiresAt) {
      return `Bearer ${cached.accessToken}`
    }

    const t1 = await this.step1_getFmiExchangeToken(agentIdentityId)
    const t2 = await this.step2_getImpersonationToken(agentIdentityId, t1)
    const resourceToken = await this.step3_getResourceToken(agentIdentityId, t1, t2, agentUserOid, scope)

    this.cache.set(cacheKey, {
      accessToken: resourceToken,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes TTL
    })

    return `Bearer ${resourceToken}`
  }

  /** Step 1: Blueprint acquires FMI exchange token (T1) via fmi_path extension. */
  private step1_getFmiExchangeToken (agentIdentityId: string): Promise<string> {
    return this.postTokenRequest({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: FMI_EXCHANGE_SCOPE,
      fmi_path: agentIdentityId,
    })
  }

  /** Step 2: Agent Identity acquires impersonation token (T2) using T1 as client_assertion. */
  private step2_getImpersonationToken (agentIdentityId: string, t1: string): Promise<string> {
    return this.postTokenRequest({
      grant_type: 'client_credentials',
      client_id: agentIdentityId,
      client_assertion_type: JWT_BEARER_TYPE,
      client_assertion: t1,
      scope: FMI_EXCHANGE_SCOPE,
    })
  }

  /** Step 3: Agent Identity acquires resource token via user_fic grant. */
  private step3_getResourceToken (agentIdentityId: string, t1: string, t2: string, agentUserOid: string, scope: string): Promise<string> {
    return this.postTokenRequest({
      grant_type: 'user_fic',
      client_id: agentIdentityId,
      client_assertion_type: JWT_BEARER_TYPE,
      client_assertion: t1,
      user_federated_identity_credential: t2,
      user_id: agentUserOid,
      requested_token_use: 'on_behalf_of',
      scope,
    })
  }

  private async postTokenRequest (params: Record<string, string>): Promise<string> {
    const logger = getLogger()
    try {
      const response = await axios.post(this.tokenEndpoint, new URLSearchParams(params).toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      return response.data.access_token
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { error?: string; error_description?: string } } }
      const status = error.response?.status ?? 'unknown'
      const errorMsg = error.response?.data?.error ?? 'unknown_error'
      const desc = error.response?.data?.error_description ?? ''
      logger.error('Agentic token request failed (HTTP %s): %s — %s', status, errorMsg, desc)
      throw new Error(`Agentic token request failed (HTTP ${status}): ${errorMsg} — ${desc}`)
    }
  }
}
