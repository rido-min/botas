// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { createHash } from 'node:crypto'
import { VERSION } from './version.js'

/**
 * PostHog client interface (subset used by botas).
 * @internal
 */
interface PostHogClient {
  capture: (options: {
    distinctId: string
    event: string
    properties?: Record<string, unknown>
  }) => void
  shutdown: () => Promise<void>
}

/**
 * PostHog module interface (subset used by botas).
 * @internal
 */
interface PostHogModule {
  PostHog: new (
    apiKey: string,
    options?: {
      host?: string
      disableGeoip?: boolean
      flushAt?: number
      flushInterval?: number
    }
  ) => PostHogClient
}

// Optional peer dependency. Loaded via dynamic import so the module works in
// environments without `posthog-node` (and avoids `createRequire`,
// which fails on Deno when modules are loaded from a remote URL like JSR).
let _posthogModule: PostHogModule | null = null
let _posthogClient: PostHogClient | null = null
let _isDisabled = false // true = env var not set or module unavailable
let _isInitialized = false
let _distinctId: string | null = null
let _botStartedEmitted = false

/** @internal Reset telemetry state — for testing only. */
export function _resetPostHogTelemetry(): void {
  _posthogModule = null
  _posthogClient = null
  _isDisabled = false
  _isInitialized = false
  _distinctId = null
  _botStartedEmitted = false
}

/**
 * Lazy-initialize PostHog client on first trackEvent call.
 * @internal
 */
function initializePostHog(): void {
  if (_isInitialized) return
  _isInitialized = true

  // Read env vars
  const apiKey = process.env.POSTHOG_API_KEY
  const host = process.env.POSTHOG_HOST ?? 'https://us.i.posthog.com'

  // If no API key, disable telemetry (zero-cost no-op)
  if (!apiKey || apiKey.trim() === '') {
    _isDisabled = true
    return
  }

  // Try to load posthog-node module (dynamic import, type-erased at runtime)
  // @ts-expect-error - posthog-node is an optional peer dependency; types may not be available
  import('posthog-node')
    .then((module: unknown) => {
      _posthogModule = module as PostHogModule
      // Create PostHog client
      _posthogClient = new _posthogModule.PostHog(apiKey, {
        host,
        disableGeoip: true, // no IP-based location
        flushInterval: 30000, // 30s batch interval
        flushAt: 20, // or every 20 events
      })

      // Compute distinct_id from CLIENT_ID
      const clientId = process.env.CLIENT_ID
      if (clientId && clientId.trim() !== '') {
        const hash = createHash('sha256').update(clientId).digest('hex')
        _distinctId = hash.substring(0, 16)
      } else {
        _distinctId = 'botas-anonymous'
      }
    })
    .catch(() => {
      // posthog-node not available — disable telemetry
      _isDisabled = true
    })
}

/**
 * Get runtime version string for Node.js.
 * @internal
 */
function getRuntimeVersion(): string {
  return `Node ${process.version}`
}

/**
 * Get sanitized channel type hint.
 * @internal
 */
function getChannelType(channelId: string | undefined): string {
  if (!channelId) return 'other'
  const lower = channelId.toLowerCase()
  if (lower === 'emulator') return 'emulator'
  if (lower === 'msteams') return 'msteams'
  if (lower === 'webchat') return 'webchat'
  return 'other'
}

/**
 * Track a PostHog event (fire-and-forget).
 * @internal
 */
export function trackEvent(name: string, properties: Record<string, unknown>): void {
  // Lazy-init on first call
  if (!_isInitialized) {
    initializePostHog()
  }

  // If disabled or client not ready, no-op
  if (_isDisabled || !_posthogClient || !_distinctId) {
    return
  }

  // Add common properties
  const allProperties = {
    sdk_language: 'node',
    sdk_version: VERSION,
    runtime_version: getRuntimeVersion(),
    ...properties,
  }

  // Fire-and-forget (never block pipeline)
  try {
    _posthogClient.capture({
      distinctId: _distinctId,
      event: name,
      properties: allProperties,
    })
  } catch {
    // Swallow all PostHog errors silently
  }
}

/**
 * Track `botas/bot_started` event (once per process lifetime).
 * @internal
 */
export function trackBotStarted(options: {
  handlerCount: number
  invokeHandlerCount: number
  middlewareCount: number
  hasCatchAll: boolean
  hasStateStorage: boolean
  authFlow: 'client_credentials' | 'managed_identity' | 'none'
}): void {
  if (_botStartedEmitted) return
  _botStartedEmitted = true

  trackEvent('botas/bot_started', {
    handler_count: options.handlerCount,
    invoke_handler_count: options.invokeHandlerCount,
    middleware_count: options.middlewareCount,
    has_catch_all: options.hasCatchAll,
    has_state_storage: options.hasStateStorage,
    auth_flow: options.authFlow,
  })
}

/**
 * Track `botas/activity_received` event.
 * @internal
 */
export function trackActivityReceived(options: {
  activityType: string
  hasHandler: boolean
  channelId: string | undefined
}): void {
  trackEvent('botas/activity_received', {
    activity_type: options.activityType,
    has_handler: options.hasHandler,
    channel_type: getChannelType(options.channelId),
  })
}

/**
 * Track `botas/handler_dispatched` event.
 * @internal
 */
export function trackHandlerDispatched(options: {
  activityType: string
  dispatchMode: 'type' | 'invoke' | 'catchall'
  durationMs: number
}): void {
  trackEvent('botas/handler_dispatched', {
    activity_type: options.activityType,
    dispatch_mode: options.dispatchMode,
    duration_ms: options.durationMs,
  })
}

/**
 * Track `botas/handler_error` event.
 * @internal
 */
export function trackHandlerError(options: {
  activityType: string
  errorType: string
}): void {
  trackEvent('botas/handler_error', {
    activity_type: options.activityType,
    error_type: options.errorType,
  })
}

/**
 * Track `botas/outbound_sent` event.
 * @internal
 */
export function trackOutboundSent(options: {
  operation: 'send' | 'update' | 'delete' | 'create_conversation'
  success: boolean
}): void {
  trackEvent('botas/outbound_sent', {
    operation: options.operation,
    success: options.success,
  })
}

/**
 * Flush buffered events on process exit (best-effort).
 * @internal
 */
export function flushOnShutdown(): void {
  if (_posthogClient) {
    _posthogClient.shutdown().catch(() => {
      // Ignore flush errors
    })
  }
}

// Register shutdown handler
process.on('exit', () => {
  flushOnShutdown()
})
