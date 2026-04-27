// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { TurnContext } from './turn-context.js'

/** Callback to invoke the next middleware (or the activity handler) in the pipeline. */
export type NextTurn = () => Promise<void>

/**
 * A middleware function that participates in the turn processing pipeline.
 *
 * Add cross-cutting logic (e.g. logging, telemetry) that runs before or
 * after each activity is handled. Call `next()` to continue to the next
 * middleware or handler.
 *
 * @example
 * const logging: TurnMiddleware = async (context, next) => {
 *   console.log('activity type:', context.activity.type)
 *   await next()
 * }
 *
 * bot.use(logging)
 */
export type TurnMiddleware = (
  context: TurnContext,
  next: NextTurn
) => Promise<void>

/**
 * @deprecated Use {@link TurnMiddleware} function type instead.
 */
export type ITurnMiddleware = { onTurnAsync: TurnMiddleware }
