// OpenTelemetry setup — must be imported before any other modules.
// Uses the Microsoft OpenTelemetry distro for single-call onboarding
// with auto-instrumentation for HTTP, Azure SDK, and database clients.
//
// Export targets are configured via environment variables:
//   APPLICATIONINSIGHTS_CONNECTION_STRING → Azure Monitor (Application Insights)
//   OTEL_EXPORTER_OTLP_ENDPOINT          → OTLP collector (Aspire Dashboard, Jaeger, Grafana)
//
// If neither is set, telemetry defaults to Console output.
//
// To view traces locally with Aspire Dashboard:
//   docker run -p 4317:4317 -p 18888:18888 mcr.microsoft.com/dotnet/aspire-dashboard:latest
//   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 OTEL_SERVICE_NAME=otel-bot npx tsx index.ts

import { useMicrosoftOpenTelemetry } from '@microsoft/opentelemetry'

useMicrosoftOpenTelemetry({
  instrumentationOptions: {
    http: {
      enabled: true,
    },
    azureSdk: {
      enabled: true,
    }
  },
})
