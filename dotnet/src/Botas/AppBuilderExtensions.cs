using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
namespace Botas;

public static class AppBuilderExtensions
{
    public static TApp UseBotApplication<TApp>(
        this IApplicationBuilder builder,
        string routePath = "api/messages",
        string authorizationPolicy = "DefaultPolicy")
            where TApp : BotApplication, new()
    {
        WebApplication? webApp = builder as WebApplication;
        TApp app = builder.ApplicationServices.GetService<TApp>() ?? throw new InvalidOperationException("Application not registered");
        builder.UseAuthentication();
        builder.UseAuthorization();

        webApp?.MapPost(routePath, async (HttpContext httpContext, CancellationToken cancellationToken) =>
        {
            await app.ProcessAsync(httpContext, cancellationToken);
            return Results.Ok();
        }).RequireAuthorization(authorizationPolicy);

        return app;
    }

    public static TApp UseBotApplication<TApp>(
        this IApplicationBuilder builder,
        TApp app,
        string routePath = "api/messages",
        string authorizationPolicy = "DefaultPolicy")
            where TApp : BotApplication, new()
    {
        WebApplication? webApp = builder as WebApplication;
        builder.UseAuthentication();
        builder.UseAuthorization();

        webApp?.MapPost(routePath, async (HttpContext httpContext, CancellationToken cancellationToken) =>
        {
            await app.ProcessAsync(httpContext, cancellationToken);
            return Results.Ok();
        }).RequireAuthorization(authorizationPolicy);

        return app;
    }
}
