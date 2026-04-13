using Botas;

WebApplicationBuilder webAppBuilder = WebApplication.CreateSlimBuilder(args);
webAppBuilder.Services.AddBotApplication<BotApplication>();
WebApplication webApp = webAppBuilder.Build();
var botApp = webApp.UseBotApplication<BotApplication>();

webApp.MapGet("/", () => Results.Ok($"Bot {botApp.AppId} Running in aspnet"));

botApp.OnActivity = async (context, ct) =>
{
    if (context.Activity.Type == "message")
    {
        await context.SendAsync($"Echo: {context.Activity.Text}, from aspnet", ct);
    }
};
webApp.Run();