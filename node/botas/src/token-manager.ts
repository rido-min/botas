// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
  ConfidentialClientApplication,
  ManagedIdentityApplication,
  type AuthenticationResult,
  type LogLevel as MSALLogLevel,
} from '@azure/msal-node'
import { getLogger } from './logger.js'

const BOT_TOKEN_SCOPE = 'https://api.botframework.com/.default'
const BOT_TOKEN_TENANT = 'botframework.com'
const AUTHORITY_BASE = 'https://login.microsoftonline.com'

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
 * Manages Bot Framework access token acquisition via MSAL.
 *
 * Supports four authentication flows, selected automatically based on the
 * options provided:
 *
 * 1. **Client credentials** — `clientId` + `clientSecret`
 * 2. **Custom token factory** — `token` callback
 * 3. **User managed identity** — `clientId` only (no secret)
 * 4. **Federated identity** — `clientId` + `managedIdentityClientId` (different IDs)
 */
export class TokenManager {
  private readonly opts: ResolvedOptions
  private confidentialClients: Record<string, ConfidentialClientApplication> = {}
  private managedIdentityClient: ManagedIdentityApplication | null = null

  constructor (options: TokenManagerOptions = {}) {
    this.opts = {
      clientId: options.clientId ?? '',
      clientSecret: options.clientSecret ?? '',
      tenantId: options.tenantId ?? '',
      token: options.token,
      managedIdentityClientId: options.managedIdentityClientId ?? '',
    }
  }

  /** Acquire a Bot Framework access token. */
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

    if (token) {
      getLogger().debug('Acquiring token via custom factory scope=%s tenantId=%s', scope, tenantId)
      return token(scope, tenantId)
    }

    if (clientSecret) {
      getLogger().debug('Acquiring token via client credentials clientId=%s tenantId=%s', clientId, tenantId)
      return this.getTokenWithClientCredentials(clientId, clientSecret, scope, tenantId)
    }

    const hasFederated =
      managedIdentityClientId &&
      managedIdentityClientId.toLowerCase() !== clientId.toLowerCase()

    if (hasFederated) {
      getLogger().debug('Acquiring token via federated identity clientId=%s', clientId)
      return this.getTokenWithFederatedCredentials(
        clientId,
        managedIdentityClientId!,
        scope,
        tenantId
      )
    }

    getLogger().debug('Acquiring token via managed identity clientId=%s', clientId)
    return this.getTokenWithManagedIdentity(clientId, scope)
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

  private msalLoggerOptions (): { logLevel: MSALLogLevel; loggerCallback: () => void; piiLoggingEnabled: boolean } {
    return {
      logLevel: 3 /* Warning */ as MSALLogLevel,
      loggerCallback: () => {},
      piiLoggingEnabled: false,
    }
  }
}

function stripDefault (scope: string): string {
  return scope.replace('/.default', '')
}
