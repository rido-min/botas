import { getRandomGuid } from '@rido-min/core'

export function start (): void {
  const id = getRandomGuid()
  console.log('Starting hosting (5)...', id)
}
