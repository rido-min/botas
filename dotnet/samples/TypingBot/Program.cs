using Botas;

var app = BotApp.Create(args);

// Handle message with typing indicator before replying
app.On("message", async (context, ct) =>
{
    // Send typing indicator to show bot is processing
    await context.SendTypingAsync(ct);
    
    // Simulate some processing time
    await Task.Delay(1500, ct);
    
    // Send the actual response
    await context.SendAsync($"You said: {context.Activity.Text}", ct);
});

app.Run();
