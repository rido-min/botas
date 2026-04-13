// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** Tenant information from Teams channel data. */
export interface TenantInfo {
  id?: string
  [key: string]: unknown
}

/** Channel information from Teams channel data. */
export interface ChannelInfo {
  id?: string
  name?: string
  [key: string]: unknown
}

/** Team information from Teams channel data. */
export interface TeamInfo {
  id?: string
  name?: string
  aadGroupId?: string
  [key: string]: unknown
}

/** Meeting information from Teams channel data. */
export interface MeetingInfo {
  id?: string
  [key: string]: unknown
}

/** Notification settings from Teams channel data. */
export interface NotificationInfo {
  alert?: boolean
  [key: string]: unknown
}

/** Teams-specific channel data attached to an activity. */
export interface TeamsChannelData {
  tenant?: TenantInfo
  channel?: ChannelInfo
  team?: TeamInfo
  meeting?: MeetingInfo
  notification?: NotificationInfo
  [key: string]: unknown
}
