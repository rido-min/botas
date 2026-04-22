// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * A quick-reply button or action displayed to the user.
 *
 * Card actions represent clickable options in clients that support suggested actions
 * or hero/thumbnail cards.
 */
export interface CardAction {
  /** Action type (e.g. `"imBack"`, `"postBack"`, `"openUrl"`, `"messageBack"`). */
  type: string
  /** Display text on the button. */
  title?: string
  /** Value sent back to the bot when the action is invoked. */
  value?: string
  /** Text to insert into the compose box when the action is invoked. */
  text?: string
  /** Text shown in the chat feed when the action is invoked (may differ from `text`). */
  displayText?: string
  /** URL to an icon image displayed on the button. */
  image?: string
  /** Additional channel-specific properties. */
  [key: string]: unknown
}

/**
 * Suggested actions (quick-reply buttons) attached to an activity.
 *
 * When present, the channel renders the actions as tappable buttons below
 * the message. Actions are typically removed after the user selects one.
 */
export interface SuggestedActions {
  /** Recipient IDs that should see the suggested actions. Empty or omitted means all participants. */
  to?: string[]
  /** The list of actions to display. */
  actions: CardAction[]
  /** Additional channel-specific properties. */
  [key: string]: unknown
}
