using System.Collections.Concurrent;
using Azure.AI.OpenAI;
using Botas;
using Microsoft.Extensions.AI;
using OpenAI;

var endpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT") ?? "";
var apiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY") ?? "";
var deployment = Environment.GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT") ?? "gpt-4o";

IChatClient chatClient = new AzureOpenAIClient(
    new Uri(endpoint), new System.ClientModel.ApiKeyCredential(apiKey))
    .GetChatClient(deployment)
    .AsIChatClient();

var conversationHistories = new ConcurrentDictionary<string, List<ChatMessage>>();

var app = BotApp.Create(args);

app.On("message", async (context, ct) =>
{
    var conversationId = context.Activity.Conversation!.Id!;
    var history = conversationHistories.GetOrAdd(conversationId, _ => []);

    history.Add(new ChatMessage(ChatRole.User, context.Activity.Text ?? ""));

    var response = await chatClient.GetResponseAsync(history, cancellationToken: ct);

    var assistantMessage = response.Text ?? "";
    history.Add(new ChatMessage(ChatRole.Assistant, assistantMessage));

    await context.SendAsync(assistantMessage, ct);
});

app.Run();
