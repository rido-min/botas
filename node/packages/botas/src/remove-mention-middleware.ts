// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { TurnMiddleware } from './i-turn-middleware.js'
import type { TurnContext } from './turn-context.js'
import type { Entity } from './core-activity.js'

/** Shape of a mention entity as sent by Bot Framework channels. */
interface MentionEntity extends Entity {
  type: 'mention'
  mentioned: { id: string; name?: string }
  text: string
}

function isMentionEntity (entity: Entity): entity is MentionEntity {
  return (
    entity.type === 'mention' &&
    typeof (entity as MentionEntity).mentioned?.id === 'string' &&
    typeof (entity as MentionEntity).text === 'string'
  )
}

/**
 * Creates a middleware that strips the bot's own @mention from incoming
 * activity text.
 *
 * In channels like Microsoft Teams, messages directed at the bot include an
 * `<at>BotName</at>` tag in `activity.text`. This middleware removes that tag
 * so handlers receive the clean user intent.
 *
 * @example
 * ```ts
 * import { BotApplication, removeMentionMiddleware } from 'botas-core'
 *
 * const bot = new BotApplication()
 * bot.use(removeMentionMiddleware())
 *
 * bot.on('message', async (ctx) => {
 *   // ctx.activity.text no longer contains "<at>BotName</at>"
 *   await ctx.send(`You said: ${ctx.activity.text}`)
 * })
 * ```
 */
export function removeMentionMiddleware (): TurnMiddleware {
  return async (context: TurnContext, next) => {
    const { activity } = context

    if (activity.text && activity.entities?.length) {
      const botId = context.app.options.clientId ?? activity.recipient?.id
      if (botId) {
        for (const entity of activity.entities) {
          if (isMentionEntity(entity) && entity.mentioned.id.toLowerCase() === botId.toLowerCase()) {
            const pattern = new RegExp(escapeRegExp(entity.text), 'gi')
            activity.text = activity.text.replace(pattern, '').trim()
          }
        }
      }
    }

    await next()
  }
}

/**
 * @deprecated Use {@link removeMentionMiddleware} factory function instead.
 */
export class RemoveMentionMiddleware {
  async onTurnAsync (context: TurnContext, next: () => Promise<void>): Promise<void> {
    return removeMentionMiddleware()(context, next)
  }
}

function escapeRegExp (str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
