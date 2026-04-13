// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** A quick-reply button or action. */
export interface CardAction {
  type: string
  title?: string
  value?: string
  text?: string
  displayText?: string
  image?: string
  [key: string]: unknown
}

/** Suggested actions (quick reply buttons) for an activity. */
export interface SuggestedActions {
  to?: string[]
  actions: CardAction[]
  [key: string]: unknown
}
