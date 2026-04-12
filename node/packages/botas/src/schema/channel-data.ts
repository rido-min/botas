// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** Base channel data attached to an activity. */
export interface ChannelData {
  /** Client-generated activity ID. */
  clientActivityId?: string;
  /** Additional channel-specific properties. */
  [key: string]: unknown;
}
