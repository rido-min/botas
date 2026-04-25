// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { validateBotToken, BotAuthError } from 'botas-core'

type ExpressRequest = { headers: Record<string, string | string[] | undefined> }
type ExpressResponse = { status(code: number): ExpressResponse; end(msg?: string): void; json(body: unknown): void }
type NextFn = (err?: unknown) => void

/**
 * Express middleware that validates the Bot Service JWT token.
 *
 * @param appId - The bot's client ID. Falls back to CLIENT_ID env var.
 *
 * @example
 * server.post('/api/messages', botAuthExpress(), (req, res) => bot.processAsync(req, res))
 */
export function botAuthExpress (
  appId?: string
): (req: ExpressRequest, res: ExpressResponse, next: NextFn) => Promise<void> {
  // #95: Validate required env vars at startup, not at first request
  const audience = appId ?? process.env['CLIENT_ID']
  if (!audience) {
    throw new Error('botAuthExpress: CLIENT_ID environment variable (or appId parameter) is required when auth is enabled')
  }
  return async (req, res, next) => {
    const header = req.headers['authorization'] as string | undefined
    try {
      await validateBotToken(header, appId)
      next()
    } catch (err: unknown) {
      if (err instanceof BotAuthError) {
        res.status(401).json({ error: 'Unauthorized', message: err.message })
      } else {
        next(err)
      }
    }
  }
}
