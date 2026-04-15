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
        builder.UseExceptionHandler(errorApp =>
        {
            errorApp.Run(async context =>
            {
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync("{}");
            });
        });
        builder.UseAuthentication();
        builder.UseAuthorization();

        webApp?.MapPost(routePath, async (HttpContext httpContext, CancellationToken cancellationToken) =>
        {
            await app.ProcessAsync(httpContext, cancellationToken);
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
        builder.UseExceptionHandler(errorApp =>
        {
            errorApp.Run(async context =>
            {
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync("{}");
            });
        });
        builder.UseAuthentication();
        builder.UseAuthorization();

        webApp?.MapPost(routePath, async (HttpContext httpContext, CancellationToken cancellationToken) =>
        {
            await app.ProcessAsync(httpContext, cancellationToken);
        }).RequireAuthorization(authorizationPolicy);

        return app;
    }
}
