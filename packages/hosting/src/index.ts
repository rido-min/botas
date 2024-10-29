import { Activity } from '@rido-min/core'

export function start (): void {
  const myActivity: Activity = {
    callerId: 'callerid',
    serviceUrl: 'serviceurl',
    type: 'activity',
    localTimezone: 'localtimezone',
    channelId: 'channelid',
    from: {
      id: 'fromid',
      name: 'fromname'
    },
    conversation: {
      id: 'conversationid',
      name: 'conversationname',
      conversationType: 'conversationtype',
      isGroup: true
    },
    recipient: {
      id: 'recipientid',
      name: 'recipientname'
    },
    text: 'text',
    label: 'label',
    valueType: 'valueType',
    listenFor: []
  }

  console.log('basic activity', myActivity)
}
