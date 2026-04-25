// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { Server } from 'node:http'
import express from 'express'
import {
  BotApplication,
  type BotApplicationOptions,
  type CoreActivity,
  type CoreActivityHandler,
  type InvokeActivityHandler,
  type TurnMiddleware,
  type ResourceResponse,
  getLogger,
} from 'botas-core'
import { botAuthExpress } from './bot-auth-express.js'

/**
 * Options for {@link BotApp}.
 *
 * Extends the core {@link BotApplicationOptions} with Express-specific
 * settings for port, route path, and auth toggle.
 */
export interface BotAppOptions extends BotApplicationOptions {
  /** Port to listen on. Defaults to the `PORT` env var or `3978`. */
  port?: number
  /** Path for the messages endpoint. Defaults to `"/api/messages"`. */
  path?: string
  /**
   * Whether to enable inbound JWT auth.
   * Defaults to `true` when `CLIENT_ID` is configured, `false` otherwise.
   */
  auth?: boolean
}

/**
 * Zero-boilerplate bot host that composes a {@link BotApplication} with an
 * Express server.
 *
 * @example
 * ```ts
 * import { BotApp } from 'botas-express'
 *
 * const app = new BotApp()
 * app.on('message', async (ctx) => {
 *   await ctx.send('you said: ' + ctx.activity.text)
 * })
 * app.start()
 * ```
 */
export class BotApp {
  /** The underlying BotApplication instance. */
  readonly bot: BotApplication

  private readonly _options: BotAppOptions

  constructor (options: BotAppOptions = {}) {
    this._options = options
    this.bot = new BotApplication(options)
  }

  /**
   * Register a handler for an activity type.
   * Delegates to {@link BotApplication.on}.
   */
  on (type: string, handler: CoreActivityHandler): this {
    this.bot.on(type, handler)
    return this
  }

  /**
   * Register a handler for an invoke activity by its `activity.name` sub-type.
   * Delegates to {@link BotApplication.onInvoke}.
   */
  onInvoke (name: string, handler: InvokeActivityHandler): this {
    this.bot.onInvoke(name, handler)
    return this
  }

  /**
   * Register a middleware in the turn pipeline.
   * Delegates to {@link BotApplication.use}.
   */
  use (middleware: TurnMiddleware): this {
    this.bot.use(middleware)
    return this
  }

  /**
   * Proactively send an activity to a conversation.
   * Delegates to {@link BotApplication.sendActivityAsync}.
   */
  async sendActivityAsync (
    serviceUrl: string,
    conversationId: string,
    activity: Partial<CoreActivity>
  ): Promise<ResourceResponse | undefined> {
    return this.bot.sendActivityAsync(serviceUrl, conversationId, activity)
  }

  /**
   * Start the Express server.
   *
   * Creates routes for the bot messages endpoint, a health check, and a
   * root status page, then begins listening.
   *
   * @returns The underlying `http.Server` — call `.close()` to shut down.
   */
  start (): Server {
    const port = this._options.port ?? Number(process.env['PORT'] ?? 3978)
    const path = this._options.path ?? '/api/messages'
    const authEnabled = this._options.auth ?? !!this.bot.options.clientId

    const app = express()

    if (authEnabled) {
      app.post(path, botAuthExpress(this.bot.options.clientId), (req, res) => {
        this.bot.processAsync(req, res)
      })
    } else {
      app.post(path, (req, res) => {
        this.bot.processAsync(req, res)
      })
    }

    app.all(path, (_req, res) => {
      res.status(405).set('Allow', 'POST').json({ error: 'Method Not Allowed' })
    })

    app.get('/health', (_req, res) => { res.json({ status: 'ok' }) })
    app.get('/', (_req, res) => {
      res.send(`Bot ${this.bot.options.clientId ?? '(no client ID)'} is running. Send messages to ${path}`)
    })

    const server = app.listen(port, () => {
      getLogger().info('BotApp listening on http://localhost:%d%s', port, path)
    })

    return server
  }
}
