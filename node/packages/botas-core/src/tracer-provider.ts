// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { Span, Tracer } from '@opentelemetry/api'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

let _tracer: Tracer | null | undefined // undefined = not yet initialized
let _api: typeof import('@opentelemetry/api') | null = null

/**
 * Returns the shared OpenTelemetry tracer for botas instrumentation.
 * Returns `null` when `@opentelemetry/api` is not installed — all span
 * operations become no-ops and the library works without telemetry.
 */
/** @internal Reset the cached tracer — for testing only. */
export function resetTracer (): void {
  _tracer = undefined
  _api = null
}

export function getTracer (): Tracer | null {
  if (_tracer !== undefined) return _tracer
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _api = require('@opentelemetry/api') as typeof import('@opentelemetry/api')
    const pkg = require('../package.json') as { version: string }
    _tracer = _api.trace.getTracer('botas', pkg.version)
  } catch {
    _tracer = null
  }
  return _tracer
}

/**
 * Start a named span, set it as the active span in context, and run the callback.
 * Child spans created inside `fn` will be linked as children of this span.
 * When `@opentelemetry/api` is not available, `fn` is called directly with a `null` span.
 */
export async function withActiveSpan<T> (
  name: string,
  fn: (span: Span | null) => Promise<T>
): Promise<T> {
  const tracer = getTracer()
  if (!tracer || !_api) return fn(null)

  const span = tracer.startSpan(name)
  const ctx = _api.trace.setSpan(_api.context.active(), span)
  return _api.context.with(ctx, async () => {
    try {
      return await fn(span)
    } catch (err) {
      span.recordException(err instanceof Error ? err : new Error(String(err)))
      throw err
    } finally {
      span.end()
    }
  })
}
