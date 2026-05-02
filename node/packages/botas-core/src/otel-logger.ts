// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { Logger } from './logger.js'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/**
 * A logger that emits log records via the OpenTelemetry Logs API.
 *
 * Logs are exported as structured OTel log records through the configured
 * OTLP exporter (e.g., to Grafana Loki, Azure Monitor, or console).
 *
 * Requires `@opentelemetry/api-logs` at runtime (included when using
 * `@microsoft/opentelemetry` distro). Falls back to `console` if unavailable.
 *
 * @example
 * ```ts
 * import { configure, createOtelLogger } from 'botas-core'
 * const logger = createOtelLogger()
 * if (logger) configure(logger)
 * ```
 */
export function createOtelLogger (): Logger | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const logsApi = require('@opentelemetry/api-logs') as typeof import('@opentelemetry/api-logs')
    const pkg = require('../package.json') as { version: string }
    const otelLogger = logsApi.logs.getLogger('botas', pkg.version)

    const { SeverityNumber } = logsApi

    const emit = (severityNumber: number, severityText: string, message: string, args: unknown[]): void => {
      const body = args.length > 0 ? formatMessage(message, args) : message
      otelLogger.emit({
        severityNumber,
        severityText,
        body,
      })
    }

    return {
      trace (message, ...args) {
        emit(SeverityNumber.TRACE, 'TRACE', message, args)
      },
      debug (message, ...args) {
        emit(SeverityNumber.DEBUG, 'DEBUG', message, args)
      },
      info (message, ...args) {
        emit(SeverityNumber.INFO, 'INFO', message, args)
      },
      warn (message, ...args) {
        emit(SeverityNumber.WARN, 'WARN', message, args)
      },
      error (message, ...args) {
        emit(SeverityNumber.ERROR, 'ERROR', message, args)
      },
    }
  } catch {
    return null
  }
}

/** Simple printf-style formatter for %s placeholders. */
function formatMessage (message: string, args: unknown[]): string {
  let i = 0
  return message.replace(/%s/g, () => {
    if (i < args.length) {
      const val = args[i++]
      return typeof val === 'string' ? val : String(val)
    }
    return '%s'
  })
}
