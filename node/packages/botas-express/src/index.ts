// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export { BotApp } from './bot-app.js'
export type { BotAppOptions } from './bot-app.js'

// Re-export core types so consumers only need one import
export {
  type BotApplicationOptions,
  type CoreActivity,
  type CoreActivityHandler,
  type ITurnMiddleware,
  type NextTurn,
  type TurnContext,
  type ResourceResponse,
  BotApplication,
  CoreActivityBuilder,
  ActivityType,
  BotHandlerException,
  configure,
  consoleLogger,
  debugLogger,
  noopLogger,
} from 'botas-core'
