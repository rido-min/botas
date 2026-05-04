// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { Counter, Histogram, Meter } from '@opentelemetry/api'
import { VERSION } from './version.js'

// Optional peer dependency. Loaded via dynamic import so the module works in
// environments without `@opentelemetry/api` (and avoids `createRequire`,
// which fails on Deno when modules are loaded from a remote URL like JSR).
let _api: typeof import('@opentelemetry/api') | null = null
try {
  _api = await import('@opentelemetry/api')
} catch {
  _api = null
}

let _meter: Meter | null | undefined // undefined = not yet initialized

/** @internal Reset the cached meter — for testing only. */
export function resetMeter (): void {
  _meter = undefined
  _metrics = null
}

export function getMeter (): Meter | null {
  if (_meter !== undefined) return _meter
  if (_api) {
    _meter = _api.metrics.getMeter('botas', VERSION)
  } else {
    _meter = null
  }
  return _meter
}

/** Pre-created metric instruments for botas. */
export interface BotasMetrics {
  /** Counter: total activities received, tagged by activity.type */
  activitiesReceived: Counter
  /** Histogram: turn processing duration in milliseconds */
  turnDuration: Histogram
  /** Counter: handler errors, tagged by activity.type */
  handlerErrors: Counter
  /** Histogram: middleware execution duration in milliseconds */
  middlewareDuration: Histogram
  /** Counter: outbound API calls to Bot Service */
  outboundApiCalls: Counter
  /** Counter: outbound API errors */
  outboundApiErrors: Counter
}

let _metrics: BotasMetrics | null = null

/**
 * Returns pre-created metric instruments, or `null` when `@opentelemetry/api` is unavailable.
 */
export function getMetrics (): BotasMetrics | null {
  if (_metrics !== null) return _metrics

  const meter = getMeter()
  if (!meter) return null

  _metrics = {
    activitiesReceived: meter.createCounter('botas.activities.received', {
      description: 'Total activities received by the bot',
      unit: '{activity}',
    }),
    turnDuration: meter.createHistogram('botas.turn.duration', {
      description: 'Duration of turn processing',
      unit: 'ms',
    }),
    handlerErrors: meter.createCounter('botas.handler.errors', {
      description: 'Total handler errors',
      unit: '{error}',
    }),
    middlewareDuration: meter.createHistogram('botas.middleware.duration', {
      description: 'Duration of individual middleware execution',
      unit: 'ms',
    }),
    outboundApiCalls: meter.createCounter('botas.outbound.calls', {
      description: 'Total outbound API calls to Bot Service',
      unit: '{call}',
    }),
    outboundApiErrors: meter.createCounter('botas.outbound.errors', {
      description: 'Total outbound API call errors',
      unit: '{error}',
    }),
  }

  return _metrics
}
