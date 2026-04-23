// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Core activity type strings used by BotApplication for dispatch.
 *
 * @example
 * bot.on('message', async ({ activity, send }) => {
 *   await send(`You said: ${activity.text}`);
 * });
 */
export type ActivityType = 'message' | 'typing' | 'invoke'

/**
 * Extended activity type strings for Teams and other Bot Framework channels.
 *
 * Includes all core types plus channel-specific activity types commonly
 * used in Microsoft Teams bots.
 *
 * @example
 * bot.on('conversationUpdate', async (ctx) => {
 *   console.log('Members changed');
 * });
 */
export type TeamsActivityType =
  | ActivityType
  | 'event'
  | 'conversationUpdate'
  | 'messageUpdate'
  | 'messageDelete'
  | 'messageReaction'
  | 'installationUpdate'
