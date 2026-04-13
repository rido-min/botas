// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import jwt from 'jsonwebtoken'
import jwksClient from 'jwks-rsa'
import axios from 'axios'
import { getLogger } from './logger.js'

const BOT_FRAMEWORK_ISSUER = 'https://api.botframework.com'
const BOT_OPENID_METADATA_URL =
  'https://login.botframework.com/v1/.well-known/openidconfiguration'

const ALLOWED_METADATA_PREFIXES = [
  'https://login.botframework.com/',
  'https://login.microsoftonline.com/',
]

function isAllowedMetadataUrl (url: string): boolean {
  return ALLOWED_METADATA_PREFIXES.some(prefix => url.startsWith(prefix))
}

const jwksCache = new Map<string, ReturnType<typeof jwksClient>>()

async function getJwksForMetadata (metadataUrl: string): Promise<ReturnType<typeof jwksClient>> {
  let client = jwksCache.get(metadataUrl)
  if (!client) {
    getLogger().debug('Fetching JWKS URI from %s', metadataUrl)
    const resp = await axios.get<{ jwks_uri: string }>(metadataUrl)
    const jwksUri = resp.data.jwks_uri
    getLogger().debug('JWKS URI resolved: %s', jwksUri)
    client = jwksClient({ jwksUri })
    jwksCache.set(metadataUrl, client)
  }
  return client
}

/**
 * Decode the JWT payload without signature verification to peek at claims.
 * Used to select the correct OpenID metadata endpoint before full validation.
 */
function peekClaims (token: string): { iss?: string; tid?: string; aud?: string } {
  const decoded = jwt.decode(token, { complete: true })
  if (!decoded || typeof decoded.payload === 'string') return {}
  return {
    iss: decoded.payload['iss'] as string | undefined,
    tid: decoded.payload['tid'] as string | undefined,
    aud: decoded.payload['aud'] as string | undefined,
  }
}

/**
 * Select the OpenID metadata URL based on the token's issuer claim.
 * See specs/inbound-auth.md for the discovery rules.
 */
function resolveMetadataUrl (iss: string | undefined, tid: string | undefined): string {
  if (iss === BOT_FRAMEWORK_ISSUER) {
    return BOT_OPENID_METADATA_URL
  }
  const tenantId = tid ?? 'botframework.com'
  return `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`
}

/**
 * Build the list of valid issuers for a given tenant ID.
 * Matches the issuers defined in specs/inbound-auth.md.
 */
function validIssuers (tid?: string): string[] {
  const issuers = [BOT_FRAMEWORK_ISSUER]
  if (tid) {
    issuers.push(`https://sts.windows.net/${tid}/`)
    issuers.push(`https://login.microsoftonline.com/${tid}/v2`)
    issuers.push(`https://login.microsoftonline.com/${tid}/v2.0`)
  }
  return issuers
}

/**
 * Validates a Bot Framework or Entra ID Bearer token.
 * Throws {@link BotAuthError} if the token is missing, malformed, or fails validation.
 *
 * Supports tokens from both the Bot Framework channel service and Azure AD/Entra ID.
 * The correct OpenID configuration is selected dynamically by inspecting the token's
 * `iss` claim before full validation (see specs/inbound-auth.md).
 *
 * @param authHeader - The Authorization header value (e.g. `"Bearer <token>"`)
 * @param appId - The bot's client ID (audience). Falls back to CLIENT_ID env var.
 */
export async function validateBotToken (
  authHeader: string | undefined,
  appId?: string
): Promise<void> {
  const audience = appId ?? process.env['CLIENT_ID']
  if (!audience) throw new BotAuthError('No appId configured for token validation')

  if (!authHeader?.startsWith('Bearer ')) {
    getLogger().debug('Auth failed: missing or malformed Authorization header')
    throw new BotAuthError('Missing or invalid Authorization header')
  }

  const token = authHeader.slice(7)
  getLogger().debug('Validating token for audience %s', audience)

  const { iss, tid, aud } = peekClaims(token)
  getLogger().debug('Token issuer=%s tid=%s aud=%s', iss, tid, aud)

  const allowedIssuers = validIssuers(tid) as [string, ...string[]]
  if (!iss || !allowedIssuers.includes(iss)) {
    getLogger().debug('Token rejected: untrusted issuer=%s', iss)
    throw new BotAuthError('Untrusted token issuer')
  }

  const metadataUrl = resolveMetadataUrl(iss, tid)
  getLogger().debug('Using OpenID metadata: %s', metadataUrl)

  if (!isAllowedMetadataUrl(metadataUrl)) {
    getLogger().debug('Rejected disallowed metadata URL: %s', metadataUrl)
    throw new BotAuthError('Untrusted token issuer')
  }

  const jwks = await getJwksForMetadata(metadataUrl)
  const allowedAudiences: [string, ...string[]] = [audience, `api://${audience}`, BOT_FRAMEWORK_ISSUER]

  await new Promise<void>((resolve, reject) => {
    jwt.verify(
      token,
      (header, callback) => {
        getLogger().trace('Fetching signing key kid=%s', header.kid)
        jwks.getSigningKey(header.kid, (err, key) => {
          if (err) {
            getLogger().debug('Signing key fetch failed: %s', err.message)
            return callback(err, undefined)
          }
          callback(null, key?.getPublicKey())
        })
      },
      {
        audience: allowedAudiences,
        issuer: allowedIssuers,
        algorithms: ['RS256'],
      },
      (err: jwt.VerifyErrors | null) => {
        if (err) {
          getLogger().debug('Token validation failed: %s', err.message)
          reject(new BotAuthError(`Token validation failed: ${err.message}`))
        } else {
          getLogger().debug('Token validated successfully')
          resolve()
        }
      }
    )
  })
}

/** Error thrown when Bot Framework JWT validation fails. */
export class BotAuthError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'BotAuthError'
  }
}

// ── Express middleware ────────────────────────────────────────────────────────

type ExpressRequest = { headers: Record<string, string | string[] | undefined> }
type ExpressResponse = { status(code: number): ExpressResponse; end(msg?: string): void }
type NextFn = (err?: unknown) => void

/**
 * Express middleware that validates the Bot Framework JWT token.
 *
 * @param appId - The bot's client ID. Falls back to CLIENT_ID env var.
 *
 * @example
 * server.post('/api/messages', botAuthExpress(), (req, res) => bot.processAsync(req, res))
 */
export function botAuthExpress (
  appId?: string
): (req: ExpressRequest, res: ExpressResponse, next: NextFn) => Promise<void> {
  return async (req, res, next) => {
    const header = req.headers['authorization'] as string | undefined
    try {
      await validateBotToken(header, appId)
      next()
    } catch (err: unknown) {
      if (err instanceof BotAuthError) {
        res.status(401).end(err.message)
      } else {
        next(err)
      }
    }
  }
}

// ── Hono middleware ───────────────────────────────────────────────────────────

type HonoContext = {
  req: { header(name: string): string | undefined }
  text(body: string, status?: number): Response
}
type HonoNext = () => Promise<Response | void>

/**
 * Hono middleware that validates the Bot Framework JWT token.
 *
 * @param appId - The bot's client ID. Falls back to CLIENT_ID env var.
 *
 * @example
 * honoApp.post('/api/messages', botAuthHono(), async (c) => {
 *   await bot.processBody(await c.req.text())
 *   return c.json({})
 * })
 */
export function botAuthHono (
  appId?: string
): (c: HonoContext, next: HonoNext) => Promise<Response | void> {
  return async (c, next) => {
    const header = c.req.header('authorization')
    try {
      await validateBotToken(header, appId)
      return next()
    } catch (err) {
      if (err instanceof BotAuthError) {
        return c.text(err.message, 401)
      }
      throw err
    }
  }
}
