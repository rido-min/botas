using Botas;

var app = BotApp.Create(args);

app.On("message", async (context, ct) =>
{
    await context.SendAsync($"Echo: {context.Activity.Text}, from aspnet", ct);
});

app.OnInvoke("test/echo", async (context, ct) =>
{
    return new InvokeResponse { Status = 200, Body = context.Activity.Value };
});

app.Run();