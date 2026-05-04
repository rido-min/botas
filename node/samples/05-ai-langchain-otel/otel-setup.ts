// OpenTelemetry setup — must be imported before any other modules.
// Enables the Microsoft OTel distro with LangChain auto-instrumentation.
//
// Export targets are configured via environment variables:
//   APPLICATIONINSIGHTS_CONNECTION_STRING → Azure Monitor (Application Insights)
//   OTEL_EXPORTER_OTLP_ENDPOINT          → OTLP collector (Aspire Dashboard, Jaeger, Grafana)
//
// If neither is set, telemetry defaults to Console output.
//
// To view traces locally with Aspire Dashboard:
//   docker run -p 4317:4317 -p 18888:18888 mcr.microsoft.com/dotnet/aspire-dashboard:latest
//   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 OTEL_SERVICE_NAME=langchain-bot npx tsx index.ts

import { useMicrosoftOpenTelemetry } from '@microsoft/opentelemetry'
import { diag, trace, SpanStatusCode, type Span } from '@opentelemetry/api'

// Suppress noisy "Current logger will be overwritten" / "will overwrite one already
// registered" warnings emitted when @microsoft/opentelemetry's NodeSDK calls
// diag.setLogger() without passing { suppressOverrideMessage: true }.
// See https://github.com/rido-min/botas/issues/311
const originalSetLogger = diag.setLogger.bind(diag)
diag.setLogger = (logger, optionsOrLogLevel) => {
    if (typeof optionsOrLogLevel === 'number') {
        return originalSetLogger(logger, { logLevel: optionsOrLogLevel, suppressOverrideMessage: true })
    }
    return originalSetLogger(logger, { ...optionsOrLogLevel, suppressOverrideMessage: true })
}
import { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import type { Serialized } from '@langchain/core/load/serializable'
import type { LLMResult } from '@langchain/core/outputs'

const tracer = trace.getTracer('langchain')

/** Bridges LangChain run lifecycle events into OpenTelemetry spans. */
export class LangChainOtelCallbackHandler extends BaseCallbackHandler {
    name = 'LangChainOtelCallbackHandler'
    private spans = new Map<string, Span>()

    override handleLLMStart(_llm: Serialized, _prompts: string[], runId: string) {
        const span = tracer.startSpan('langchain.llm')
        this.spans.set(runId, span)
    }

    override handleLLMEnd(output: LLMResult, runId: string) {
        const span = this.spans.get(runId)
        if (!span) return
        const usage = (output as any).llmOutput?.tokenUsage
        if (usage) {
            span.setAttributes({
                'llm.usage.prompt_tokens': usage.promptTokens ?? 0,
                'llm.usage.completion_tokens': usage.completionTokens ?? 0,
                'llm.usage.total_tokens': usage.totalTokens ?? 0,
            })
        }
        span.end()
        this.spans.delete(runId)
    }

    override handleLLMError(error: Error, runId: string) {
        const span = this.spans.get(runId)
        if (!span) return
        span.recordException(error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
        span.end()
        this.spans.delete(runId)
    }

    override handleChainStart(_chain: Serialized, _inputs: Record<string, unknown>, runId: string) {
        const span = tracer.startSpan('langchain.chain')
        this.spans.set(runId, span)
    }

    override handleChainEnd(_outputs: Record<string, unknown>, runId: string) {
        this.spans.get(runId)?.end()
        this.spans.delete(runId)
    }

    override handleChainError(error: Error, runId: string) {
        const span = this.spans.get(runId)
        if (!span) return
        span.recordException(error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
        span.end()
        this.spans.delete(runId)
    }
}

useMicrosoftOpenTelemetry({
    instrumentationOptions: {
        http: { enabled: true },
        azureSdk: { enabled: true },
        langchain: {
            enabled: true,
        },
    },
})
