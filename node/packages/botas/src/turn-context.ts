// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { BotApplication } from './bot-application.js'
import type { CoreActivity, ResourceResponse } from './core-activity.js'
import { CoreActivityBuilder } from './core-activity.js'

/**
 * Context for a single activity turn, passed to handlers and middleware.
 *
 * Provides the incoming activity, a reference to the bot application,
 * and a scoped {@link send} method that automatically routes replies
 * back to the originating conversation.
 *
 * @example
 * bot.on('message', async (ctx) => {
 *   await ctx.send(`You said: ${ctx.activity.text}`)
 * })
 */
export interface TurnContext {
  /** The incoming activity being processed. */
  readonly activity: CoreActivity

  /** The BotApplication instance processing this turn. */
  readonly app: BotApplication

  /**
   * Send a reply to the conversation that originated this turn.
   *
   * Accepts a plain text string (sent as a `message` activity) or a
   * partial CoreActivity for full control over the reply payload.
   * Routing fields are automatically populated from the incoming activity.
   */
  send(activityOrText: string | Partial<CoreActivity>): Promise<ResourceResponse | undefined>
}

/**
 * Default TurnContext implementation used by the pipeline.
 * @internal
 */
export function createTurnContext (app: BotApplication, activity: CoreActivity): TurnContext {
  return {
    activity,
    app,
    send (activityOrText: string | Partial<CoreActivity>): Promise<ResourceResponse | undefined> {
      const reply = typeof activityOrText === 'string'
        ? new CoreActivityBuilder()
          .withConversationReference(activity)
          .withText(activityOrText)
          .build()
        : {
            ...new CoreActivityBuilder()
              .withConversationReference(activity)
              .build(),
            ...activityOrText,
          }
      return app.sendActivityAsync(activity.serviceUrl, activity.conversation.id, reply)
    },
  }
}
