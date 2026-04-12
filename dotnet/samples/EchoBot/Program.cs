using Botas;
using Botas.Hosting;

WebApplicationBuilder webAppBuilder = WebApplication.CreateSlimBuilder(args);
webAppBuilder.Services.AddBotApplication<BotApplication>();
WebApplication webApp = webAppBuilder.Build();
var botApp = webApp.UseBotApplication<BotApplication>();

webApp.MapGet("/", () => Results.Ok("Bot Running"));

botApp.OnActivity = async (activity, ct) =>
{
    await botApp.SendActivityAsync(activity, ct);
};
webApp.Run();