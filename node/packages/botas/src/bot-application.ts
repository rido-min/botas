// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { CoreActivity, ResourceResponse } from './core-activity.js'
import type { TurnMiddleware } from './i-turn-middleware.js'
import type { TurnContext } from './turn-context.js'
import { createTurnContext } from './turn-context.js'
import { ConversationClient } from './conversation-client.js'

import { TokenManager } from './token-manager.js'
import type { BotApplicationOptions } from './bot-application-options.js'
import { getLogger } from './logger.js'

/** A function that handles a specific activity type. */
export type CoreActivityHandler = (context: TurnContext) => Promise<void>

/** Wraps an exception thrown by an activity handler with the originating activity. */
export class BotHandlerException extends Error {
  constructor (
    message: string,
    public readonly cause: unknown,
    public readonly activity: CoreActivity
  ) {
    super(message)
    this.name = 'BotHandlerException'
  }
}

/**
 * Core bot application that processes incoming Bot Framework activities.
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
  /** Resolved options for this application instance. */
  readonly options: BotApplicationOptions

  /** Client for sending, updating, and deleting activities via the Bot Framework API. */
  readonly conversationClient: ConversationClient

  /**
   * Optional CatchAll handler. When set, completely replaces per-type handler
   * dispatch — all activities are delivered directly to this handler.
   */
  onActivity?: CoreActivityHandler

  private readonly middlewares: TurnMiddleware[] = []
  private readonly handlers = new Map<string, CoreActivityHandler>()
  private readonly tokenManager: TokenManager

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
    this.handlers.set(type, handler)
    return this
  }

  /**
   * Add a middleware to the turn processing pipeline.
   *
   * Middleware runs in registration order before the activity handler.
   *
   * @returns `this` for method chaining.
   */
  use (middleware: TurnMiddleware): this {
    this.middlewares.push(middleware)
    return this
  }

  /**
   * Process an incoming HTTP request (Express / Node.js `http.Server`).
   *
   * Reads the request body, validates the activity, runs the middleware
   * pipeline, and writes a `200 {}` response. Writes `500` on error.
   */
  async processAsync (req: IncomingMessage, res: ServerResponse): Promise<void> {
    getLogger().debug('Start processing HTTP request for activity')
    try {
      const body = await readBody(req)
      await this.processBody(body)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('{}')
    } catch {
      res.writeHead(500)
      res.end('Internal server error')
    }
  }

  /**
   * Process a raw JSON request body without touching the HTTP layer.
   *
   * Use this with frameworks that manage their own response lifecycle (e.g.
   * Hono), where writing to `ServerResponse` directly would cause issues.
   */
  async processBody (body: string): Promise<void> {
    const activity = safeJsonParse(body) as CoreActivity
    assertCoreActivity(activity)
    getLogger().info('CoreActivity received: type=%s serviceUrl=%s', activity.type, activity.serviceUrl)
    getLogger().trace('Received activity: %s', body)
    try {
      await this.runPipelineAsync(activity)
      getLogger().info('Finished processing activity: type=%s', activity.type)
    } catch (err) {
      getLogger().error('Error processing activity: type=%s', activity.type, err)
      throw err
    }
  }

  /**
   * Proactively send an activity to a conversation.
   *
   * @param serviceUrl - Bot Framework service URL.
   * @param conversationId - Target conversation ID.
   * @param activity - CoreActivity payload to send.
   */
  async sendActivityAsync (
    serviceUrl: string,
    conversationId: string,
    activity: Partial<CoreActivity>
  ): Promise<ResourceResponse | undefined> {
    return this.conversationClient.sendCoreActivityAsync(serviceUrl, conversationId, activity)
  }

  /** @internal Dispatch the activity to the CatchAll or per-type handler. */
  protected async handleCoreActivityAsync (context: TurnContext): Promise<void> {
    const handler = this.onActivity ?? this.handlers.get(context.activity.type)
    if (handler) {
      try {
        await handler(context)
      } catch (err) {
        throw new BotHandlerException(
          `Handler for "${context.activity.type}" threw an error`,
          err,
          context.activity
        )
      }
    }
  }

  private async runPipelineAsync (activity: CoreActivity): Promise<void> {
    const context = createTurnContext(this, activity)
    let index = 0
    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        await this.middlewares[index++](context, next)
      } else {
        await this.handleCoreActivityAsync(context)
      }
    }
    await next()
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

function assertCoreActivity (value: unknown): asserts value is CoreActivity {
  if (typeof value !== 'object' || value === null) {
    throw new Error('CoreActivity must be a JSON object')
  }
  const a = value as Record<string, unknown>
  if (typeof a['type'] !== 'string' || !a['type']) {
    throw new Error('CoreActivity missing required field: type')
  }
  if (typeof a['serviceUrl'] !== 'string' || !a['serviceUrl']) {
    throw new Error('CoreActivity missing required field: serviceUrl')
  }
  if (
    typeof a['conversation'] !== 'object' ||
    a['conversation'] === null ||
    typeof (a['conversation'] as Record<string, unknown>)['id'] !== 'string' ||
    !(a['conversation'] as Record<string, unknown>)['id']
  ) {
    throw new Error('CoreActivity missing required field: conversation.id')
  }
}

function readBody (req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
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
