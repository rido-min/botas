// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { Counter, Histogram, Meter } from '@opentelemetry/api'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

let _meter: Meter | null | undefined // undefined = not yet initialized

/** @internal Reset the cached meter — for testing only. */
export function resetMeter (): void {
  _meter = undefined
  _metrics = null
}

export function getMeter (): Meter | null {
  if (_meter !== undefined) return _meter
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require('@opentelemetry/api') as typeof import('@opentelemetry/api')
    const pkg = require('../package.json') as { version: string }
    _meter = api.metrics.getMeter('botas', pkg.version)
  } catch {
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
