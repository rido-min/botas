// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { Conversation } from './core-activity.js'

/** Teams-specific conversation with additional metadata. */
export interface TeamsConversation extends Conversation {
  conversationType?: string
  tenantId?: string
  isGroup?: boolean
  name?: string
}
