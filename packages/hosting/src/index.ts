import {getRandomGuid} from '@botas/core'

export function start() {

    var id = getRandomGuid();
    console.log('Starting hosting...', id);
}