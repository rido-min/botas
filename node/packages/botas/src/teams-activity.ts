// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { CoreActivity } from './core-activity.js'
import type { TeamsChannelData } from './teams-channel-data.js'
import type { SuggestedActions } from './suggested-actions.js'

/** A Teams-specific activity with strongly-typed channel data and helpers. */
export interface TeamsActivity extends CoreActivity {
  channelData?: TeamsChannelData
  timestamp?: string
  localTimestamp?: string
  locale?: string
  localTimezone?: string
  suggestedActions?: SuggestedActions
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const TeamsActivity = {
  /**
   * Creates a TeamsActivity from a CoreActivity.
   * Copies all fields and treats channelData as TeamsChannelData.
   */
  fromActivity (activity: CoreActivity): TeamsActivity {
    if (!activity) throw new Error('activity is required')
    return { ...activity } as TeamsActivity
  }
} as const
