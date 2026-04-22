// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Well-known Bot Framework activity type strings.
 *
 * @example
 * bot.on(ActivityType.Message, async ({ activity, send }) => {
 *   await send(`You said: ${activity.text}`);
 * });
 */
export const ActivityType = {
  /** A user-to-bot or bot-to-user text message. */
  Message: 'message',
  /** Indicates the sender is typing; shown as a visual indicator in clients. */
  Typing: 'typing',
  /** A custom event activity, typically used for proactive notifications. */
  Event: 'event',
  /** A synchronous request/response call (e.g. Teams task modules, Adaptive Card actions). */
  Invoke: 'invoke',
  /** Internal response wrapper for invoke results (not typically registered directly). */
  InvokeResponse: 'invokeResponse',
  /** Members joined or left the conversation, or the conversation metadata changed. */
  ConversationUpdate: 'conversationUpdate',
  /** An existing message was edited. */
  MessageUpdate: 'messageUpdate',
  /** An existing message was deleted. */
  MessageDelete: 'messageDelete',
  /** A reaction (like, heart, etc.) was added to or removed from a message. */
  MessageReaction: 'messageReaction',
  /** The bot was installed or uninstalled in a scope (personal, team, group chat). */
  InstallationUpdate: 'installationUpdate',
  /** Signals that the conversation should be transferred to another agent or service. */
  HandOff: 'handoff',
  /** A diagnostic trace activity, visible only in the Bot Framework Emulator. */
  Trace: 'trace',
  /** Indicates the conversation has ended. */
  EndOfConversation: 'endOfConversation',
  /** A command sent to the bot (e.g. from a Teams command bar). */
  Command: 'command',
  /** The result of a previously issued command. */
  CommandResult: 'commandResult',
} as const

/** Union type of all known activity type strings. */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType]
