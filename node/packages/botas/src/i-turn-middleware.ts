// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { TurnContext } from './turn-context.js'

/** Callback to invoke the next middleware (or the activity handler) in the pipeline. */
export type NextTurn = () => Promise<void>

/**
 * A middleware that participates in the turn processing pipeline.
 *
 * Implement this interface to add cross-cutting logic (e.g. logging,
 * telemetry) that runs before or after each activity is handled.
 *
 * @example
 * class LoggingMiddleware implements ITurnMiddleware {
 *   async onTurnAsync(context, next) {
 *     console.log('activity type:', context.activity.type);
 *     await next();
 *   }
 * }
 */
export interface ITurnMiddleware {
  /**
   * Called once per incoming activity turn.
   *
   * @param context - The turn context containing the activity, app, and send method.
   * @param next - Call this to continue to the next middleware or handler.
   */
  onTurnAsync(
    context: TurnContext,
    next: NextTurn
  ): Promise<void>;
}
