// OTel Bot — echo bot with OpenTelemetry observability
// Run: npx tsx index.ts
//
// OTel setup must come before any other imports so auto-instrumentation
// hooks into HTTP and Azure SDK modules at load time.
//
// View traces locally with the Aspire Dashboard:
//   docker run -p 4317:4317 -p 18888:18888 mcr.microsoft.com/dotnet/aspire-dashboard:latest
//   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 OTEL_SERVICE_NAME=otel-bot npx tsx index.ts
//   Open http://localhost:18888 to see traces, logs, and metrics.

import './otel-setup.js'

import { BotApp } from 'botas-express'
import { configure, consoleLogger, createOtelLogger } from 'botas-core'

configure(createOtelLogger() ?? consoleLogger)

const app = new BotApp()

app.on('message', async (ctx) => {
  await ctx.send(`You said: ${ctx.activity.text}`)
})

app.start()
