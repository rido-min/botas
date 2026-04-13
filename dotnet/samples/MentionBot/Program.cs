// MentionBot — demonstrates RemoveMentionMiddleware
//
// In Teams, messages to a bot include an @mention (e.g. "<at>BotName</at> hello").
// RemoveMentionMiddleware strips the bot's @mention from the activity text
// so your handler receives clean input like "hello".

using Botas;

var app = BotApp.Create(args);

// Register the middleware — it runs before every handler
app.Use(new RemoveMentionMiddleware());

app.On("message", async (context, ct) =>
{
    // context.Activity.Text is already cleaned by the middleware
    await context.SendAsync($"You said: {context.Activity.Text}", ct);
});

app.Run();
