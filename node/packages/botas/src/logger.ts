// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import createDebug from 'debug'

/**
 * Minimal logger interface. Implement this to integrate with any logging
 * framework (pino, winston, console, etc.).
 */
export interface Logger {
  /** Verbose diagnostic detail — API URLs, full payloads. */
  trace(message: string, ...args: unknown[]): void
  /** Configuration and internal flow information. */
  debug(message: string, ...args: unknown[]): void
  /** Key operational events — activity received, token acquired. */
  info(message: string, ...args: unknown[]): void
  /** Recoverable issues — running without auth, unexpected responses. */
  warn(message: string, ...args: unknown[]): void
  /** Failures during activity processing or API calls. */
  error(message: string, ...args: unknown[]): void
}

/** A logger that discards all messages. */
export const noopLogger: Logger = {
  trace () {},
  debug () {},
  info () {},
  warn () {},
  error () {},
}

/**
 * Default logger backed by the `debug` package.
 *
 * Each level maps to a separate namespace so you can filter precisely:
 *
 * ```sh
 * DEBUG=botas:*            # all levels
 * DEBUG=botas:info,botas:warn,botas:error  # info and above
 * DEBUG=botas:error        # errors only
 * ```
 */
export const debugLogger: Logger = {
  trace: createDebug('botas:trace'),
  debug: createDebug('botas:debug'),
  info: createDebug('botas:info'),
  warn: createDebug('botas:warn'),
  error: createDebug('botas:error'),
}

/**
 * A logger that writes to `console` with a level prefix.
 *
 * @example
 * import { configure, consoleLogger } from 'botas-core'
 * configure(consoleLogger)
 */
export const consoleLogger: Logger = {
  trace (message, ...args) { console.debug(`[TRACE] ${message}`, ...args) },
  debug (message, ...args) { console.debug(`[DEBUG] ${message}`, ...args) },
  info (message, ...args) { console.info(`[INFO]  ${message}`, ...args) },
  warn (message, ...args) { console.warn(`[WARN]  ${message}`, ...args) },
  error (message, ...args) { console.error(`[ERROR] ${message}`, ...args) },
}

let _logger: Logger = debugLogger

/**
 * Configure the logger used by all botas components.
 * Call this once at application startup, before creating a bot.
 *
 * @example
 * import { configure, consoleLogger } from 'botas-core'
 * configure(consoleLogger)
 */
export function configure (logger: Logger): void {
  _logger = logger
}

/** @internal */
export function getLogger (): Logger {
  return _logger
}
