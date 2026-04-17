using Botas;

var app = BotApp.Create(args);

app.On("message", async (context, ct) =>
{
    await context.SendAsync($"Echo: {context.Activity.Text}, from aspnet", ct);
});

app.Run();