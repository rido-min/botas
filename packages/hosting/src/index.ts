import {getRandomGuid} from '@botas/core'

export function start() {

    const id = getRandomGuid();
    console.log('Starting hosting...', id);
}