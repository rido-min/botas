using Botas;

WebApplicationBuilder webAppBuilder = WebApplication.CreateSlimBuilder(args);
webAppBuilder.Services.AddBotApplication<BotApplication>();
WebApplication webApp = webAppBuilder.Build();
var botApp = webApp.UseBotApplication<BotApplication>();

webApp.MapGet("/", () => Results.Ok($"Bot {botApp.AppId} Running in aspnet"));

botApp.OnActivity = async (activity, ct) =>
{
    var reply = new CoreActivityBuilder()
        .WithConversationReference(activity)
        .WithText($"Echo: {activity.Text}, from aspnet")
        .Build();
    await botApp.SendActivityAsync(reply, ct);
};
webApp.Run();