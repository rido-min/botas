using Botas;
using Botas.Hosting;
using Botas.Schema;

WebApplicationBuilder webAppBuilder = WebApplication.CreateSlimBuilder(args);
webAppBuilder.Services.AddBotApplication<BotApplication>();
WebApplication webApp = webAppBuilder.Build();
var botApp = webApp.UseBotApplication<BotApplication>();

webApp.MapGet("/", () => Results.Ok($"Bot {botApp.AppId} Running in aspnet"));

botApp.OnActivity = async (activity, ct) =>
{
    await botApp.SendActivityAsync(
        new CoreActivity() {
            Type = "message",
            Text = $"Echo: {activity.Text}, from aspnet",
            Conversation = activity.Conversation,
            ServiceUrl = activity.ServiceUrl    
    }, ct);
};
webApp.Run();