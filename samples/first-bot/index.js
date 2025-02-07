// @ts-check
import { scopeFromClaimsOrDefault, scopeFromClaims } from '@rido-min/hosting'
import { ActivityTypes} from '@rido-min/core/actv4'

const att = ActivityTypes.Command
console.log(att)

//start()
const req1 = {
    user : {
        azp: 'azp_only'
    }
}
console.log(scopeFromClaimsOrDefault(req1))
console.log(scopeFromClaims(req1))

const req2 = {
    user : {
        appid: 'aid_only'
    }
}
console.log(scopeFromClaimsOrDefault(req2))
console.log(scopeFromClaims(req2))

const req3 = {
    user : {
    }
}
console.log(scopeFromClaimsOrDefault(req3))
console.log(scopeFromClaims(req3))
console.log(scopeFromClaimsOrDefault({}))
console.log(scopeFromClaims({}))
//>>@ts-expect-error
//console.log(scopeFromClaims())
//>>@ts-expect-error
//console.log(scopeFromClaims(null))