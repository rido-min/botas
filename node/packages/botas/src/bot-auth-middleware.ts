// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { createHash } from 'node:crypto'
import { jwtVerify, decodeJwt, createRemoteJWKSet } from 'jose'
import type { JWTPayload } from 'jose'
import axios from 'axios'
import { getLogger } from './logger.js'

const BOT_FRAMEWORK_ISSUER = 'https://api.botframework.com'
const BOT_OPENID_METADATA_URL =
  'https://login.botframework.com/v1/.well-known/openidconfiguration'

const ALLOWED_METADATA_PREFIXES = [
  'https://login.botframework.com/',
  'https://login.microsoftonline.com/',
]

// ── Rate limiting for failed token validations (#70) ─────────────────────────

const FAILURE_COOLDOWN_MS = 5_000
const failureCache = new Map<string, number>()

function hashToken (token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16)
}

function isRateLimited (token: string): boolean {
  const hash = hashToken(token)
  const failedAt = failureCache.get(hash)
  if (failedAt && Date.now() - failedAt < FAILURE_COOLDOWN_MS) {
    return true
  }
  return false
}

function recordFailure (token: string): void {
  const hash = hashToken(token)
  failureCache.set(hash, Date.now())
  // Evict stale entries periodically to prevent unbounded growth
  if (failureCache.size > 1000) {
    const now = Date.now()
    for (const [key, timestamp] of failureCache) {
      if (now - timestamp >= FAILURE_COOLDOWN_MS) failureCache.delete(key)
    }
  }
}

// ── SSRF protection: serviceUrl allowlist (#91) ──────────────────────────────

const ALLOWED_SERVICE_URL_PATTERNS = [
  /^https:\/\/[^/]*\.botframework\.com(\/|$)/i,
  /^https:\/\/[^/]*\.botframework\.us(\/|$)/i,
  /^https:\/\/[^/]*\.botframework\.cn(\/|$)/i,
  /^https:\/\/[^/]*\.trafficmanager\.net(\/|$)/i,
]

/**
 * Validate that a serviceUrl is a known Bot Framework endpoint.
 * Prevents SSRF by blocking arbitrary URLs from incoming activities.
 *
 * @throws {BotAuthError} when the URL is not on the allowlist.
 */
export function validateServiceUrl (serviceUrl: string): void {
  // Allow localhost/127.0.0.1 for local development
  try {
    const parsed = new URL(serviceUrl)
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return
    }
  } catch {
    throw new BotAuthError(`Invalid serviceUrl: ${serviceUrl}`)
  }

  const allowed = ALLOWED_SERVICE_URL_PATTERNS.some(p => p.test(serviceUrl))
  if (!allowed) {
    getLogger().warn('Rejected untrusted serviceUrl: %s', serviceUrl)
    throw new BotAuthError(`Untrusted serviceUrl: ${serviceUrl}`)
  }
}

function isAllowedMetadataUrl (url: string): boolean {
  return ALLOWED_METADATA_PREFIXES.some(prefix => url.startsWith(prefix))
}

// ── JWKS + metadata cache ────────────────────────────────────────────────────

type JwksEntry = { jwksUri: string; remoteJwks: ReturnType<typeof createRemoteJWKSet>; createdAt: number }
const jwksCache = new Map<string, JwksEntry>()
const JWKS_CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const JWKS_CACHE_MAX_SIZE = 50

async function getJwksForMetadata (metadataUrl: string): Promise<ReturnType<typeof createRemoteJWKSet>> {
  const entry = jwksCache.get(metadataUrl)
  if (entry && Date.now() - entry.createdAt < JWKS_CACHE_TTL_MS) {
    return entry.remoteJwks
  }

  getLogger().debug('Fetching JWKS URI from %s', metadataUrl)
  const resp = await axios.get<{ jwks_uri: string }>(metadataUrl, { timeout: 5_000 })
  const jwksUri = resp.data.jwks_uri
  getLogger().debug('JWKS URI resolved: %s', jwksUri)

  // Re-use cached entry if jwks_uri hasn't changed
  if (entry && entry.jwksUri === jwksUri) {
    entry.createdAt = Date.now()
    return entry.remoteJwks
  }

  const remoteJwks = createRemoteJWKSet(new URL(jwksUri))

  // Evict oldest entries if cache is at capacity
  if (jwksCache.size >= JWKS_CACHE_MAX_SIZE) {
    const oldestKey = jwksCache.keys().next().value!
    jwksCache.delete(oldestKey)
  }

  jwksCache.set(metadataUrl, { jwksUri, remoteJwks, createdAt: Date.now() })
  return remoteJwks
}

/**
 * Decode the JWT payload without signature verification to peek at claims.
 * Used to select the correct OpenID metadata endpoint before full validation.
 * Returns {} for malformed tokens — the caller rejects untrusted issuers.
 */
function peekClaims (token: string): { iss?: string; tid?: string; aud?: string } {
  try {
    const payload: JWTPayload = decodeJwt(token)
    return {
      iss: payload.iss,
      tid: payload['tid'] as string | undefined,
      aud: typeof payload.aud === 'string' ? payload.aud : payload.aud?.[0],
    }
  } catch {
    return {}
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

  // Rate limit: reject recently-failed tokens immediately
  if (isRateLimited(token)) {
    getLogger().debug('Token rejected: rate limited (recent failure)')
    throw new BotAuthError('Too many failed validation attempts')
  }

  getLogger().debug('Validating token for audience %s', audience)

  const { iss, tid, aud } = peekClaims(token)
  getLogger().debug('Token issuer=%s tid=%s aud=%s', iss, tid, aud)

  const allowedIssuers = validIssuers(tid)
  if (!iss || !allowedIssuers.includes(iss)) {
    getLogger().debug('Token rejected: untrusted issuer=%s', iss)
    recordFailure(token)
    throw new BotAuthError('Untrusted token issuer')
  }

  const metadataUrl = resolveMetadataUrl(iss, tid)
  getLogger().debug('Using OpenID metadata: %s', metadataUrl)

  if (!isAllowedMetadataUrl(metadataUrl)) {
    getLogger().debug('Rejected disallowed metadata URL: %s', metadataUrl)
    recordFailure(token)
    throw new BotAuthError('Untrusted token issuer')
  }

  const jwks = await getJwksForMetadata(metadataUrl)
  const allowedAudiences: string[] = [audience, `api://${audience}`, BOT_FRAMEWORK_ISSUER]

  try {
    await jwtVerify(token, jwks, {
      audience: allowedAudiences,
      issuer: allowedIssuers,
      algorithms: ['RS256'],
    })
    getLogger().debug('Token validated successfully')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    getLogger().debug('Token validation failed: %s', msg)
    recordFailure(token)
    throw new BotAuthError(`Token validation failed: ${msg}`)
  }
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
  // #95: Validate required env vars at startup, not at first request
  const audience = appId ?? process.env['CLIENT_ID']
  if (!audience) {
    throw new Error('botAuthExpress: CLIENT_ID environment variable (or appId parameter) is required when auth is enabled')
  }
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
  // #95: Validate required env vars at startup, not at first request
  const audience = appId ?? process.env['CLIENT_ID']
  if (!audience) {
    throw new Error('botAuthHono: CLIENT_ID environment variable (or appId parameter) is required when auth is enabled')
  }
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
