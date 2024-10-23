import {getRandomGuid} from '@rido-min/core'

export function start( ) {
    const id = getRandomGuid();
    console.log('Starting hosting...', id);
}