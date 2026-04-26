// Echo Bot — minimal botas-express sample with OpenTelemetry
// Run: npx tsx index.ts
//
// For observability, set env vars before starting:
//   OTEL_SERVICE_NAME=echo-bot
//   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317  (Aspire Dashboard)
// See otel-setup.ts for full details.

// OTel setup must come before any other imports
import './otel-setup.js'

import { BotApp } from 'botas-express'

const app = new BotApp()

app.on('message', async ctx => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.start()
