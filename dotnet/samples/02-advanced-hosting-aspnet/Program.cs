// Sample: ASP.NET Core manual hosting
// Shows how to use BotApplication with standard ASP.NET Core setup for full
// control over DI, middleware, routes, and server lifecycle. For a simpler
// approach, see the EchoBot sample which uses BotApp.Create().

using Botas;

WebApplicationBuilder webAppBuilder = WebApplication.CreateSlimBuilder(args);
webAppBuilder.Services.AddBotApplication<BotApplication>();
WebApplication webApp = webAppBuilder.Build();
var bot = webApp.UseBotApplication<BotApplication>();

webApp.MapGet("/", () => Results.Ok($"Bot {bot.AppId} Running in aspnet"));

bot.On("message", async (context, ct) =>
{
    await context.SendAsync($"Echo: {context.Activity.Text}, from aspnet", ct);
});

webApp.Run();
