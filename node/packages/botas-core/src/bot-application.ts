// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { Buffer } from 'node:buffer'
import type { CoreActivity, ResourceResponse } from './core-activity.js'
import type { TurnMiddleware } from './turn-middleware.js'
import type { TurnContext } from './turn-context.js'
import { createTurnContext } from './turn-context.js'
import { ConversationClient } from './conversation-client.js'

import { TokenManager } from './token-manager.js'
import type { BotApplicationOptions } from './bot-application-options.js'
import { getLogger } from './logger.js'
import { validateServiceUrl } from './bot-auth-middleware.js'
import { withActiveSpan } from './tracer-provider.js'
import { getMetrics } from './meter-provider.js'
import { VERSION } from './version.js'

/** A function that handles a specific activity type. */
export type CoreActivityHandler = (context: TurnContext) => Promise<void>

/**
 * The response returned by an invoke activity handler.
 * The `status` is written as the HTTP status code; `body` is serialized as JSON.
 *
 * @public
 */
export interface InvokeResponse {
  /** HTTP status code to return to the channel (e.g. `200`, `400`, `501`). */
  status: number
  /** Optional response body serialized as JSON. */
  body?: unknown
}

/** A function that handles an invoke activity and returns an InvokeResponse. */
export type InvokeActivityHandler = (context: TurnContext) => Promise<InvokeResponse>

/**
 * Wraps an exception thrown by an activity handler with the originating activity.
 *
 * Catch this in error-handling middleware or at the HTTP layer to inspect both the
 * original error and the activity that triggered it.
 */
export class BotHandlerException extends Error {
  /**
   * @param message - Human-readable error description.
   * @param cause - The original error thrown by the handler.
   * @param activity - The activity being processed when the error occurred.
   */
  constructor (
    message: string,
    public override readonly cause: unknown,
    public readonly activity: CoreActivity
  ) {
    super(message)
    this.name = 'BotHandlerException'
  }
}

/**
 * Core bot application that processes incoming Bot Service activities.
 *
 * Web-server-agnostic — use {@link processAsync} with Express (or any
 * Node.js `http.Server`) and {@link processBody} with frameworks that manage
 * their own HTTP response lifecycle (e.g. Hono).
 *
 * @example
 * ```ts
 * const bot = new BotApplication({ clientId: '...', clientSecret: '...' });
 *
 * bot.on('message', async ({ activity, send }) => {
 *   await send(`You said: ${activity.text}`);
 * });
 * ```
 */
export class BotApplication {
  /** The Botas SDK version. */
  static readonly version: string = VERSION

  /** Resolved options for this application instance. */
  readonly options: BotApplicationOptions

  /** Client for sending, updating, and deleting activities via the Bot Service API. */
  readonly conversationClient: ConversationClient

  /**
   * Optional CatchAll handler. When set, completely replaces per-type handler
   * dispatch — all activities are delivered directly to this handler.
   */
  onActivity?: CoreActivityHandler

  private readonly middlewares: TurnMiddleware[] = []
  private readonly handlers = new Map<string, CoreActivityHandler>()
  private readonly invokeHandlers = new Map<string, InvokeActivityHandler>()
  private readonly tokenManager: TokenManager

  /**
   * Create a new BotApplication.
   *
   * Options fall back to environment variables (`CLIENT_ID`, `CLIENT_SECRET`,
   * `TENANT_ID`) when not provided explicitly.
   *
   * @param options - Bot credentials and configuration. Defaults to env vars.
   */
  constructor (options: BotApplicationOptions = {}) {
    const resolvedOptions = resolveBotApplicationOptions(options)
    this.options = resolvedOptions
    this.tokenManager = new TokenManager(resolvedOptions)
    const tokenProvider = () =>
      this.tokenManager.getBotToken().then((t) => {
        if (!t) throw new Error('No credentials configured — set CLIENT_ID and CLIENT_SECRET (or use managed identity)')
        return t
      })
    this.conversationClient = new ConversationClient(tokenProvider)
  }

  /**
   * Register a handler for a given activity type.
   *
   * Only one handler per type is supported; registering the same type twice
   * replaces the previous handler.
   *
   * @param type - CoreActivity type string (e.g. `"message"`, `"conversationUpdate"`).
   * @param handler - Async function called with the turn context.
   * @returns `this` for method chaining.
   */
  on (type: string, handler: CoreActivityHandler): this {
    this.handlers.set(type.toLowerCase(), handler)
    return this
  }

  /**
   * Add a middleware to the turn processing pipeline.
   *
   * Middleware runs in registration order before the activity handler.
   *
   * @param middleware - Middleware function to add. See {@link TurnMiddleware}.
   * @returns `this` for method chaining.
   */
  use (middleware: TurnMiddleware): this {
    this.middlewares.push(middleware)
    return this
  }

  /**
   * Register a handler for an invoke activity by its `activity.name` sub-type.
   *
   * The handler must return an {@link InvokeResponse} — the status and body are
   * written directly to the HTTP response for invoke activities.
   *
   * Only one handler per name is supported; registering the same name twice
   * replaces the previous handler.
   *
   * @param name - The invoke name (e.g. `"adaptiveCard/action"`, `"task/fetch"`).
   * @param handler - Async function that returns an {@link InvokeResponse}.
   * @returns `this` for method chaining.
   */
  onInvoke (name: string, handler: InvokeActivityHandler): this {
    this.invokeHandlers.set(name.toLowerCase(), handler)
    return this
  }

  /**
   * Process an incoming HTTP request (Express / Node.js `http.Server`).
   *
   * Reads the request body, validates the activity, runs the middleware
   * pipeline, and writes a `200 {}` response. For `invoke` activities,
   * writes the `InvokeResponse` returned by the registered handler instead.
   * Writes `413` for oversized bodies and `500` on unhandled errors.
   *
   * @param req - Node.js incoming HTTP request.
   * @param res - Node.js server response to write the result to.
   * @throws Never — errors are caught and written to `res` as HTTP status codes.
   */
  async processAsync (req: IncomingMessage, res: ServerResponse): Promise<void> {
    getLogger().debug('Start processing HTTP request for activity')
    try {
      const body = await readBody(req)
      const invokeResponse = await this.processBody(body)
      if (invokeResponse) {
        res.writeHead(invokeResponse.status, { 'Content-Type': 'application/json' })
        res.end(invokeResponse.body !== undefined ? JSON.stringify(invokeResponse.body) : '{}')
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end('{}')
      }
    } catch (err) {
      if (res.writableEnded || res.destroyed) return
      if (err instanceof RequestBodyTooLargeError) {
        res.writeHead(413)
        res.end(err.message)
      } else if (err instanceof ActivityValidationError) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      } else {
        getLogger().error('processAsync returning 500: %s', err instanceof Error ? err.message : String(err))
        if (!res.headersSent) {
          res.writeHead(500)
        }
        res.end('Internal server error')
      }
    }
  }

  /**
   * Process a raw JSON request body without touching the HTTP layer.
   *
   * Use this with frameworks that manage their own response lifecycle (e.g.
   * Hono), where writing to `ServerResponse` directly would cause issues.
   *
   * For `invoke` activities, the returned {@link InvokeResponse} must be
   * written to the HTTP response by the caller.
   *
   * @param body - Raw JSON string from the HTTP request body.
   * @returns The {@link InvokeResponse} for `invoke` activities, or
   *   `undefined` for all other activity types.
   * @throws {Error} If the body is not valid JSON or fails activity validation.
   * @throws {BotAuthError} If the activity's `serviceUrl` is not on the allowlist.
   * @throws {BotHandlerException} If an activity handler throws during processing.
   */
  async processBody (body: string): Promise<InvokeResponse | undefined> {
    const activity = safeJsonParse(body) as CoreActivity
    assertCoreActivity(activity)
    validateServiceUrl(activity.serviceUrl)
    getLogger().info('CoreActivity received: type=%s serviceUrl=%s', activity.type, activity.serviceUrl)
    getLogger().trace('Received activity: %s', body)

    const metrics = getMetrics()
    metrics?.activitiesReceived.add(1, { 'activity.type': activity.type })
    const startTime = Date.now()

    return withActiveSpan('botas.turn', async (turnSpan) => {
      turnSpan?.setAttribute('activity.type', activity.type)
      turnSpan?.setAttribute('activity.id', activity.id ?? '')
      turnSpan?.setAttribute('conversation.id', activity.conversation?.id ?? '')
      turnSpan?.setAttribute('channel.id', activity.channelId ?? '')
      turnSpan?.setAttribute('bot.id', this.options.clientId ?? '')

      try {
        const invokeResponse = await this.runPipelineAsync(activity)
        getLogger().info('Finished processing activity: type=%s', activity.type)
        return invokeResponse
      } catch (err) {
        getLogger().error('Error processing activity: type=%s', activity.type, err)
        throw err
      } finally {
        metrics?.turnDuration.record(Date.now() - startTime, { 'activity.type': activity.type })
      }
    })
  }

  /**
   * Proactively send an activity to a conversation.
   *
   * @param serviceUrl - Bot Service service URL.
   * @param conversationId - Target conversation ID.
   * @param activity - CoreActivity payload to send.
   * @returns The {@link ResourceResponse} containing the new activity ID, or `undefined`.
   */
  async sendActivityAsync (
    serviceUrl: string,
    conversationId: string,
    activity: Partial<CoreActivity>
  ): Promise<ResourceResponse | undefined> {
    return this.conversationClient.sendCoreActivityAsync(serviceUrl, conversationId, activity)
  }

  /** @internal Dispatch the activity to the CatchAll or per-type handler. */
  protected async handleCoreActivityAsync (context: TurnContext): Promise<InvokeResponse | undefined> {
    if (context.activity.type === 'invoke') {
      return this.dispatchInvokeAsync(context)
    }

    const isCatchAll = !!this.onActivity
    const handler = this.onActivity ?? this.handlers.get(context.activity.type.toLowerCase())
    if (handler) {
      return withActiveSpan('botas.handler', async (handlerSpan) => {
        handlerSpan?.setAttribute('handler.type', context.activity.type)
        handlerSpan?.setAttribute('handler.dispatch', isCatchAll ? 'catchall' : 'type')
        try {
          await handler(context)
        } catch (err) {
          getMetrics()?.handlerErrors.add(1, { 'activity.type': context.activity.type })
          throw new BotHandlerException(
            `Handler for "${context.activity.type}" threw an error`,
            err,
            context.activity
          )
        }
        return undefined
      })
    }
    return undefined
  }

  private async dispatchInvokeAsync (context: TurnContext): Promise<InvokeResponse | undefined> {
    const name = context.activity.name
    const handler = name ? this.invokeHandlers.get(name.toLowerCase()) : undefined
    if (!handler) {
      return { status: 501 }
    }

    return withActiveSpan('botas.handler', async (handlerSpan) => {
      handlerSpan?.setAttribute('handler.type', name ?? context.activity.type)
      handlerSpan?.setAttribute('handler.dispatch', 'invoke')
      try {
        return await handler(context)
      } catch (err) {
        getMetrics()?.handlerErrors.add(1, { 'activity.type': 'invoke' })
        throw new BotHandlerException(
          `Invoke handler for "${name}" threw an error`,
          err,
          context.activity
        )
      }
    })
  }

  private async runPipelineAsync (activity: CoreActivity): Promise<InvokeResponse | undefined> {
    const context = createTurnContext(this, activity)
    let invokeResponse: InvokeResponse | undefined
    let index = 0
    const metrics = getMetrics()
    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const mw = this.middlewares[index++]!
        let nextPromise: Promise<void> | undefined
        const trackedNext = (): Promise<void> => {
          nextPromise = next()
          return nextPromise
        }
        const mwStart = Date.now()
        const mwName = mw.name || `middleware-${index - 1}`
        await withActiveSpan('botas.middleware', async (mwSpan) => {
          mwSpan?.setAttribute('middleware.name', mwName)
          mwSpan?.setAttribute('middleware.index', index - 1)
          try {
            await mw(context, trackedNext)
          } catch (err) {
            // Suppress the detached next() rejection — the middleware error takes priority
            if (nextPromise) await nextPromise.catch(() => {})
            throw err
          } finally {
            metrics?.middlewareDuration.record(Date.now() - mwStart, { 'middleware.name': mwName })
          }
        })
        if (nextPromise) await nextPromise
      } else {
        invokeResponse = await this.handleCoreActivityAsync(context)
      }
    }
    try {
      await next()
    } catch (err) {
      if (err instanceof BotHandlerException) throw err
      // #67: Propagate middleware errors with original message
      throw err
    }
    return invokeResponse
  }
}

/**
 * Parse a JSON string while blocking prototype-pollution keys
 * (`__proto__`, `constructor`, `prototype`).
 */
function safeJsonParse (body: string): unknown {
  return JSON.parse(body, (key, value) => {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return undefined
    }
    return value
  })
}

/** Maximum allowed text length for an activity. */
const MAX_ACTIVITY_TEXT_LENGTH = 50_000

/** Maximum number of entities allowed on a single activity. */
const MAX_ENTITIES_COUNT = 100

/** Maximum number of attachments allowed on a single activity. */
const MAX_ATTACHMENTS_COUNT = 50

/**
 * Thrown when an incoming activity fails structural validation (missing or
 * empty required fields, oversized payloads, etc.).
 *
 * The HTTP layer should return `400 Bad Request` when this error is caught.
 */
export class ActivityValidationError extends Error {
  constructor (message: string) {
    super(message)
    this.name = 'ActivityValidationError'
  }
}

function assertCoreActivity (value: unknown): asserts value is CoreActivity {
  if (typeof value !== 'object' || value === null) {
    throw new ActivityValidationError('CoreActivity must be a JSON object')
  }
  const a = value as Record<string, unknown>
  if (typeof a['type'] !== 'string' || !a['type']) {
    throw new ActivityValidationError('Missing required field: type')
  }
  if (typeof a['serviceUrl'] !== 'string' || !a['serviceUrl']) {
    throw new ActivityValidationError('Missing required field: serviceUrl')
  }
  if (
    typeof a['conversation'] !== 'object' ||
    a['conversation'] === null ||
    typeof (a['conversation'] as Record<string, unknown>)['id'] !== 'string' ||
    !(a['conversation'] as Record<string, unknown>)['id']
  ) {
    throw new ActivityValidationError('Missing required field: conversation.id')
  }
  // #76: Validate activity field sizes to prevent abuse
  if (typeof a['text'] === 'string' && a['text'].length > MAX_ACTIVITY_TEXT_LENGTH) {
    throw new ActivityValidationError(`CoreActivity text exceeds maximum length of ${MAX_ACTIVITY_TEXT_LENGTH}`)
  }
  if (Array.isArray(a['entities']) && a['entities'].length > MAX_ENTITIES_COUNT) {
    throw new ActivityValidationError(`CoreActivity entities array exceeds maximum size of ${MAX_ENTITIES_COUNT}`)
  }
  if (Array.isArray(a['attachments']) && a['attachments'].length > MAX_ATTACHMENTS_COUNT) {
    throw new ActivityValidationError(`CoreActivity attachments array exceeds maximum size of ${MAX_ATTACHMENTS_COUNT}`)
  }
}

/** Maximum allowed request body size in bytes (1 MB). */
const MAX_BODY_BYTES = 1 * 1024 * 1024

/**
 * Thrown when an incoming request body exceeds the maximum allowed size (1 MB).
 *
 * The HTTP layer returns a `413` status code when this error is caught.
 */
export class RequestBodyTooLargeError extends Error {
  constructor () {
    super('Request body too large')
    this.name = 'RequestBodyTooLargeError'
  }
}

function readBody (req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    req.on('data', (chunk: Buffer) => {
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        req.destroy()
        return reject(new RequestBodyTooLargeError())
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function resolveBotApplicationOptions (options: BotApplicationOptions): BotApplicationOptions {
  return {
    clientId: options.clientId ?? process.env['CLIENT_ID'],
    clientSecret: options.clientSecret ?? process.env['CLIENT_SECRET'],
    tenantId: options.tenantId ?? process.env['TENANT_ID'],
    token: options.token,
    managedIdentityClientId:
      options.managedIdentityClientId ??
      (process.env['MANAGED_IDENTITY_CLIENT_ID'] as BotApplicationOptions['managedIdentityClientId']),
  }
}
