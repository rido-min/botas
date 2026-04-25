using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
namespace Botas;

/// <summary>
/// Extension methods for configuring a <see cref="BotApplication"/> on an ASP.NET Core pipeline.
/// Registers authentication, authorization, exception handling, and the messages endpoint.
/// </summary>
public static class AppBuilderExtensions
{
    /// <summary>
    /// Configures the application pipeline to host a <typeparamref name="TApp"/> bot,
    /// resolving the instance from the DI container.
    /// Sets up exception handling, authentication, authorization, and maps the messages endpoint.
    /// </summary>
    /// <typeparam name="TApp">The <see cref="BotApplication"/> subclass to host.</typeparam>
    /// <param name="builder">The application builder to configure.</param>
    /// <param name="routePath">The route path for the bot messages endpoint (default: <c>"api/messages"</c>).</param>
    /// <param name="authorizationPolicy">The authorization policy name applied to the endpoint (default: <c>"DefaultPolicy"</c>).</param>
    /// <returns>The resolved <typeparamref name="TApp"/> instance.</returns>
    /// <exception cref="InvalidOperationException">Thrown when <typeparamref name="TApp"/> is not registered in the DI container.</exception>
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
        // #247: Standard JSON error responses for auth failures
        builder.Use(async (context, next) =>
        {
            await next();
            if (context.Response.StatusCode == 401 && !context.Response.HasStarted)
            {
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync("{\"error\":\"Unauthorized\",\"message\":\"Missing or invalid Authorization header\"}");
            }
        });
        builder.UseAuthentication();
        builder.UseAuthorization();

        webApp?.MapPost(routePath, async (HttpContext httpContext, CancellationToken cancellationToken) =>
        {
            await app.ProcessAsync(httpContext, cancellationToken);
        }).RequireAuthorization(authorizationPolicy);

        webApp?.MapMethods(routePath, ["GET", "PUT", "DELETE", "PATCH"], async (HttpContext context) =>
        {
            context.Response.StatusCode = StatusCodes.Status405MethodNotAllowed;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("{\"error\":\"MethodNotAllowed\",\"message\":\"Only POST is accepted\"}");
        });

        return app;
    }

    /// <summary>
    /// Configures the application pipeline to host a pre-constructed <typeparamref name="TApp"/> bot instance.
    /// Sets up exception handling, authentication, authorization, and maps the messages endpoint.
    /// </summary>
    /// <typeparam name="TApp">The <see cref="BotApplication"/> subclass to host.</typeparam>
    /// <param name="builder">The application builder to configure.</param>
    /// <param name="app">The pre-constructed bot application instance.</param>
    /// <param name="routePath">The route path for the bot messages endpoint (default: <c>"api/messages"</c>).</param>
    /// <param name="authorizationPolicy">The authorization policy name applied to the endpoint (default: <c>"DefaultPolicy"</c>).</param>
    /// <returns>The <typeparamref name="TApp"/> instance passed in.</returns>
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
        // #247: Standard JSON error responses for auth failures
        builder.Use(async (context, next) =>
        {
            await next();
            if (context.Response.StatusCode == 401 && !context.Response.HasStarted)
            {
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync("{\"error\":\"Unauthorized\",\"message\":\"Missing or invalid Authorization header\"}");
            }
        });
        builder.UseAuthentication();
        builder.UseAuthorization();

        webApp?.MapPost(routePath, async (HttpContext httpContext, CancellationToken cancellationToken) =>
        {
            await app.ProcessAsync(httpContext, cancellationToken);
        }).RequireAuthorization(authorizationPolicy);

        webApp?.MapMethods(routePath, ["GET", "PUT", "DELETE", "PATCH"], async (HttpContext context) =>
        {
            context.Response.StatusCode = StatusCodes.Status405MethodNotAllowed;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync("{\"error\":\"MethodNotAllowed\",\"message\":\"Only POST is accepted\"}");
        });

        return app;
    }
}
