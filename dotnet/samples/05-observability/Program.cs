using System.Collections.Concurrent;
using Azure.AI.OpenAI;
using Botas;
using Microsoft.Extensions.AI;
using Microsoft.OpenTelemetry;
using OpenAI;
using OpenTelemetry;

var endpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT") ?? "";
var apiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY") ?? "";
var deployment = Environment.GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT") ?? "gpt-4o";

IChatClient chatClient = new AzureOpenAIClient(
    new Uri(endpoint), new System.ClientModel.ApiKeyCredential(apiKey))
    .GetChatClient(deployment)
    .AsIChatClient();

var conversationHistories = new ConcurrentDictionary<string, List<ChatMessage>>();

var app = BotApp.Create(args);

// OpenTelemetry setup via Microsoft distro — single-call onboarding.
// Auto-instruments HTTP server/client, Azure SDK, and AI (via Microsoft.Extensions.AI).
// Export targets configured via environment variables:
//   OTEL_EXPORTER_OTLP_ENDPOINT → OTLP collector (Grafana LGTM, Jaeger, Aspire Dashboard)
//   APPLICATIONINSIGHTS_CONNECTION_STRING → Azure Monitor
//   Defaults to Console if neither is set
//
// To run Grafana LGTM locally:
//   docker run --rm -d --name lgtm -p 3000:3000 -p 4317:4317 -p 4318:4318 grafana/otel-lgtm
//   set OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
//   Then open http://localhost:3000 (admin/admin) to view traces and metrics.

app.Builder.Logging.AddOpenTelemetry(o => o.IncludeFormattedMessage = true);
app.Services.AddOpenTelemetry()
    .UseMicrosoftOpenTelemetry(o =>
    {
        o.Exporters = ExportTarget.Otlp;
    })
    .WithTracing(t => t.AddSource("botas").AddSource("Azure.*").AddSource("OpenAI.*"))
    .WithMetrics(m => m.AddMeter("botas"));

app.On("message", async (context, ct) =>
{
    var conversationId = context.Activity.Conversation!.Id!;
    var history = conversationHistories.GetOrAdd(conversationId, _ => []);

    history.Add(new ChatMessage(ChatRole.User, context.Activity.Text ?? ""));

    await context.SendTypingAsync(ct);

    var response = await chatClient.GetResponseAsync(history, cancellationToken: ct);

    var assistantMessage = response.Text ?? "";
    history.Add(new ChatMessage(ChatRole.Assistant, assistantMessage));

    await context.SendAsync(assistantMessage, ct);
});

app.Run();
