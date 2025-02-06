import { Activity } from '@rido-min/core'

export function start (): void {
  const myActivity : Activity = {
    callerId : 'callerid',
    serviceUrl : 'serviceurl',
    type : 'activity',
    localTimezone : 'localtimezone',
    channelId : 'channelid',
    from : {
      id : 'fromid',
      name : 'fromname',
    },
    conversation : {
      id : 'conversationid',
      name : 'conversationname',
      conversationType : 'conversationtype',
      isGroup : true,
    },
    recipient : {
      id : 'recipientid',
      name : 'recipientname',
    },
    text : 'text',
    label : 'label',
    valueType: 'valueType',
    listenFor: []
  }
    
  console.log('basic activity', myActivity)
}



interface ScopeRequest {
  user?: {
    azp?: string,
    appid?: string
  }
}

export function scopeFromClaimsOrDefault(req: ScopeRequest) : string {
  let retVal = 'https://botas'
  if (req) {
    if (req.user){
      if (req.user.azp) {
        retVal = req.user.azp
      }
      if (req.user.appid) {
        retVal = req.user.appid
      }
    }
  }
  return retVal
} 

export const scopeFromClaims = (req: ScopeRequest, defaultScope : string = 'botid://botas') : string => 
 req ? req.user ? req.user?.azp ?? req.user?.appid ?? defaultScope : defaultScope : defaultScope
