// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
  ConfidentialClientApplication,
  ManagedIdentityApplication,
  type AuthenticationResult,
  type LogLevel as MSALLogLevel,
} from '@azure/msal-node'
import { getLogger } from './logger.js'
import { getTracer } from './tracer-provider.js'

const BOT_TOKEN_SCOPE = 'https://api.botframework.com/.default'
const BOT_TOKEN_TENANT = 'botframework.com'
const AUTHORITY_BASE = 'https://login.microsoftonline.com'

/**
 * Options for configuring token acquisition.
 *
 * Used by both {@link TokenManager} and {@link BotApplicationOptions}.
 * All fields are optional — omitting credentials disables authentication
 * (suitable for local development).
 */
export type TokenManagerOptions = {
  /** Application (client) ID. */
  readonly clientId?: string
  /** Client secret. */
  readonly clientSecret?: string
  /** Tenant ID. */
  readonly tenantId?: string
  /**
   * Custom token factory. When provided, called instead of MSAL for every
   * token acquisition.
   */
  readonly token?: (scope: string, tenantId: string) => Promise<string>
  /**
   * Managed identity client ID for federated identity credentials.
   * Use `"system"` for system-assigned managed identity.
   */
  managedIdentityClientId?: 'system' | (string & Record<never, never>)
}

type ResolvedOptions = Required<Omit<TokenManagerOptions, 'token'>> & {
  token?: TokenManagerOptions['token']
}

/**
 * Manages Bot Service access token acquisition via MSAL.
 *
 * Supports four authentication flows, selected automatically based on the
 * options provided:
 *
 * 1. **Client credentials** — `clientId` + `clientSecret`
 * 2. **Custom token factory** — `token` callback
 * 3. **User managed identity** — `clientId` only (no secret)
 * 4. **Federated identity** — `clientId` + `managedIdentityClientId` (different IDs)
 */
// #94: Negative cache for failed token acquisitions
const NEGATIVE_CACHE_TTL_MS = 30_000

export class TokenManager {
  private readonly opts: ResolvedOptions
  /** Keyed by `clientId:tenantId`. Single-tenant bots typically have one entry. */
  private confidentialClients: Record<string, ConfidentialClientApplication> = {}
  private managedIdentityClient: ManagedIdentityApplication | null = null
  private negativeCache: { failedAt: number; error: string } | null = null
  /** Promise deduplication: prevents concurrent token acquisitions for the same scope. */
  private pendingTokenRequest: Promise<string | null> | null = null

  /**
   * Create a new TokenManager.
   *
   * @param options - Token acquisition configuration. Falls back to env vars when omitted.
   */
  constructor (options: TokenManagerOptions = {}) {
    this.opts = {
      clientId: options.clientId ?? '',
      clientSecret: options.clientSecret ?? '',
      tenantId: options.tenantId ?? '',
      token: options.token,
      managedIdentityClientId: options.managedIdentityClientId ?? '',
    }
  }

  /**
   * Acquire a Bot Service access token for outbound API calls.
   *
   * Returns `null` when no credentials are configured (dev/testing mode).
   * Caches tokens via MSAL and deduplicates concurrent requests.
   *
   * @returns A Bearer token string, or `null` if auth is not configured.
   * @throws {Error} If token acquisition fails (error is also negative-cached for 30 s).
   */
  async getBotToken (): Promise<string | null> {
    const tenantId = this.opts.tenantId || BOT_TOKEN_TENANT
    return this.getToken(BOT_TOKEN_SCOPE, tenantId)
  }

  private async getToken (scope: string, tenantId: string): Promise<string | null> {
    const { clientId, clientSecret, token, managedIdentityClientId } = this.opts

    if (!clientId) {
      getLogger().warn('Running without auth — no clientId configured')
      return null
    }

    // Determine auth flow type for span attribute
    const authFlow = token
      ? 'custom_factory'
      : clientSecret
        ? 'client_credentials'
        : (managedIdentityClientId && managedIdentityClientId.toLowerCase() !== clientId.toLowerCase())
          ? 'federated_identity'
          : 'managed_identity'

    const tracer = getTracer()
    const authSpan = tracer?.startSpan('botas.auth.outbound')
    authSpan?.setAttribute('auth.scope', scope)
    authSpan?.setAttribute('auth.flow', authFlow)
    authSpan?.setAttribute('auth.token_endpoint', `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`)

    try {
      // #94: Return cached failure instead of hammering Azure AD
      if (this.negativeCache && Date.now() - this.negativeCache.failedAt < NEGATIVE_CACHE_TTL_MS) {
        getLogger().debug('Token acquisition skipped — negative cache hit (failed %dms ago)', Date.now() - this.negativeCache.failedAt)
        authSpan?.setAttribute('auth.cache_hit', true)
        throw new Error(`Token acquisition failed (cached): ${this.negativeCache.error}`)
      }

      if (token) {
        getLogger().debug('Acquiring token via custom factory scope=%s tenantId=%s', scope, tenantId)
        authSpan?.setAttribute('auth.cache_hit', false)
        return await token(scope, tenantId)
      }

      // #76: Promise deduplication — coalesce concurrent token requests
      if (this.pendingTokenRequest) {
        getLogger().debug('Token acquisition coalesced — reusing in-flight request')
        authSpan?.setAttribute('auth.cache_hit', true)
        return await this.pendingTokenRequest
      }

      authSpan?.setAttribute('auth.cache_hit', false)
      this.pendingTokenRequest = this.acquireTokenFromProvider(clientId, clientSecret, managedIdentityClientId, scope, tenantId)
      try {
        return await this.pendingTokenRequest
      } finally {
        this.pendingTokenRequest = null
      }
    } catch (err) {
      authSpan?.recordException(err instanceof Error ? err : new Error(String(err)))
      throw err
    } finally {
      authSpan?.end()
    }
  }

  private async acquireTokenFromProvider (
    clientId: string,
    clientSecret: string,
    managedIdentityClientId: string,
    scope: string,
    tenantId: string
  ): Promise<string | null> {
    try {
      if (clientSecret) {
        getLogger().debug('Acquiring token via client credentials clientId=%s tenantId=%s', redact(clientId), redact(tenantId))
        return await this.getTokenWithClientCredentials(clientId, clientSecret, scope, tenantId)
      }

      const hasFederated =
        managedIdentityClientId &&
        managedIdentityClientId.toLowerCase() !== clientId.toLowerCase()

      if (hasFederated) {
        getLogger().debug('Acquiring token via federated identity clientId=%s managedIdentityClientId=%s', redact(clientId), redact(managedIdentityClientId))
        return await this.getTokenWithFederatedCredentials(
          clientId,
          managedIdentityClientId,
          scope,
          tenantId
        )
      }

      getLogger().debug('Acquiring token via managed identity clientId=%s', redact(clientId))
      return await this.getTokenWithManagedIdentity(clientId, scope)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      getLogger().warn('Token acquisition failed, caching failure for %dms: %s', NEGATIVE_CACHE_TTL_MS, message)
      this.negativeCache = { failedAt: Date.now(), error: message }
      throw err
    }
  }

  private async getTokenWithClientCredentials (
    clientId: string,
    clientSecret: string,
    scope: string,
    tenantId: string
  ): Promise<string | null> {
    const client = this.getConfidentialClient(clientId, clientSecret, tenantId)
    const result = await client.acquireTokenByClientCredential({ scopes: [scope] })
    getLogger().debug('Token acquired expiresOn=%s', result?.expiresOn)
    return this.unwrap(result)
  }

  private async getTokenWithManagedIdentity (
    clientId: string,
    scope: string
  ): Promise<string | null> {
    const resource = stripDefault(scope)
    const client = this.getOrCreateManagedIdentityClient({ clientId })
    const result = await client.acquireToken({ resource })
    getLogger().debug('Token acquired expiresOn=%s', result?.expiresOn)
    return this.unwrap(result)
  }

  private async getTokenWithFederatedCredentials (
    clientId: string,
    managedIdentityClientId: string,
    scope: string,
    tenantId: string
  ): Promise<string | null> {
    const miClient = this.getOrCreateManagedIdentityClient(
      managedIdentityClientId === 'system'
        ? { system: true }
        : { userAssignedClientId: managedIdentityClientId }
    )

    const miToken = await miClient.acquireToken({
      resource: 'api://AzureADTokenExchange',
    })

    const confidentialClient = new ConfidentialClientApplication({
      auth: {
        clientId,
        clientAssertion: miToken.accessToken,
        authority: `${AUTHORITY_BASE}/${tenantId}`,
      },
      system: { loggerOptions: this.msalLoggerOptions() },
    })

    const result = await confidentialClient.acquireTokenByClientCredential({
      scopes: [scope],
    })
    getLogger().debug('Token acquired expiresOn=%s', result?.expiresOn)
    return this.unwrap(result)
  }

  private getConfidentialClient (
    clientId: string,
    clientSecret: string,
    tenantId: string
  ): ConfidentialClientApplication {
    const key = `${clientId}:${tenantId}`
    if (!this.confidentialClients[key]) {
      this.confidentialClients[key] = new ConfidentialClientApplication({
        auth: {
          clientId,
          clientSecret,
          authority: `${AUTHORITY_BASE}/${tenantId}`,
        },
        system: { loggerOptions: this.msalLoggerOptions() },
      })
    }
    return this.confidentialClients[key]
  }

  private getOrCreateManagedIdentityClient (
    identity:
      | { clientId: string }
      | { userAssignedClientId: string }
      | { system: true }
  ): ManagedIdentityApplication {
    if (!this.managedIdentityClient) {
      const params =
        'system' in identity
          ? undefined
          : 'clientId' in identity
            ? { userAssignedClientId: identity.clientId }
            : { userAssignedClientId: identity.userAssignedClientId }

      this.managedIdentityClient = new ManagedIdentityApplication({
        managedIdentityIdParams: params,
        system: { loggerOptions: this.msalLoggerOptions() },
      })
    }
    return this.managedIdentityClient
  }

  private unwrap (result: AuthenticationResult | null): string | null {
    if (!result) throw new Error('MSAL returned no token result')
    return result.accessToken
  }

  private msalLoggerOptions (): { logLevel: MSALLogLevel; loggerCallback: (level: MSALLogLevel, message: string) => void; piiLoggingEnabled: boolean } {
    const logger = getLogger()
    return {
      logLevel: 4 /* Trace */ as MSALLogLevel,
      loggerCallback: (level: MSALLogLevel, message: string) => {
        // #97: Wire MSAL logs to botas logger
        switch (level) {
          case 0: logger.error('[MSAL] %s', message); break
          case 1: logger.warn('[MSAL] %s', message); break
          case 2: logger.info('[MSAL] %s', message); break
          case 3: logger.debug('[MSAL] %s', message); break
          default: logger.trace('[MSAL] %s', message); break
        }
      },
      piiLoggingEnabled: false,
    }
  }
}

function stripDefault (scope: string): string {
  return scope.replace('/.default', '')
}

/** Redact all but the last 4 characters of a sensitive value for safe logging. */
function redact (value: string): string {
  if (value.length <= 4) return '****'
  return '****' + value.slice(-4)
}
