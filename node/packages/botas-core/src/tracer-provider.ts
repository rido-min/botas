// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { Tracer } from '@opentelemetry/api'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

let _tracer: Tracer | null | undefined // undefined = not yet initialized

/**
 * Returns the shared OpenTelemetry tracer for botas instrumentation.
 * Returns `null` when `@opentelemetry/api` is not installed — all span
 * operations become no-ops and the library works without telemetry.
 */
export function getTracer (): Tracer | null {
  if (_tracer !== undefined) return _tracer
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require('@opentelemetry/api') as typeof import('@opentelemetry/api')
    const pkg = require('../package.json') as { version: string }
    _tracer = api.trace.getTracer('botas', pkg.version)
  } catch {
    _tracer = null
  }
  return _tracer
}
