using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Identity.Abstractions;
using Microsoft.Identity.Web;
using Microsoft.Identity.Web.TokenCacheProviders.InMemory;

namespace Botas;

/// <summary>
/// Extension methods for registering <see cref="BotApplication"/> and its dependencies
/// (authentication, authorization, conversation HTTP client, token acquisition) in the DI container.
/// </summary>
public static class BotApplicationConfigurationExtensions
{
    internal const string ConversationHttpClientName = "BotFrameworkConversation";

    /// <summary>
    /// Registers a <typeparamref name="TApp"/> bot as a singleton, along with JWT authentication,
    /// authorization policies, and the conversation HTTP client needed for outbound API calls.
    /// </summary>
    /// <typeparam name="TApp">The <see cref="BotApplication"/> subclass to register.</typeparam>
    /// <param name="services">The service collection to configure.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddBotApplication<TApp>(this IServiceCollection services) where TApp : BotApplication, new()
    {
        services.AddBotAuthorization();
        services.AddBotApplicationClients();
        services.AddSingleton<TApp>();
        return services;
    }

    /// <summary>
    /// Registers a pre-constructed <typeparamref name="TApp"/> bot instance as a singleton,
    /// along with the conversation HTTP client. Does not add authorization (caller is responsible).
    /// </summary>
    /// <typeparam name="TApp">The <see cref="BotApplication"/> subclass to register.</typeparam>
    /// <param name="services">The service collection to configure.</param>
    /// <param name="app">The pre-constructed bot application instance.</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddBotApplication<TApp>(this IServiceCollection services, TApp app) where TApp : BotApplication, new()
    {
        services.AddBotApplicationClients();
        services.AddSingleton(app);
        return services;
    }

    /// <summary>
    /// Registers the conversation HTTP client with OAuth2 client-credentials token acquisition,
    /// a keyed <see cref="ConversationClient"/>, and supporting infrastructure.
    /// </summary>
    /// <param name="services">The service collection to configure.</param>
    /// <param name="aadConfigSectionName">The configuration section name for Azure AD settings (default: <c>"AzureAd"</c>).</param>
    /// <returns>The service collection for chaining.</returns>
    public static IServiceCollection AddBotApplicationClients(this IServiceCollection services, string aadConfigSectionName = "AzureAd")
    {
        services
            .AddHttpClient()
            .AddTokenAcquisition(false)
            .AddInMemoryTokenCaches()
            .AddAgentIdentities();

        services.Configure<MicrosoftIdentityApplicationOptions>(aadConfigSectionName, (options) =>
        {
            IConfiguration configuration = services.BuildServiceProvider().GetRequiredService<IConfiguration>();
            configuration.GetSection(aadConfigSectionName).Bind(options);
        });

        services.AddSingleton<AgentScopeProvider>(sp =>
        {
            IConfiguration configuration = sp.GetRequiredService<IConfiguration>();
            string agentScope = configuration[$"{aadConfigSectionName}:AgentScope"] ?? "https://api.botframework.com/.default";
            return new AgentScopeProvider(agentScope);
        });

        services.AddHttpClient(ConversationHttpClientName)
            .ConfigureHttpClient(c => c.Timeout = TimeSpan.FromSeconds(30))
            .AddHttpMessageHandler(sp => new BotAuthenticationHandler(
                sp.GetRequiredService<IAuthorizationHeaderProvider>(),
                sp.GetRequiredService<ILogger<BotAuthenticationHandler>>(),
                sp.GetRequiredService<AgentScopeProvider>().Scope,
                aadConfigSectionName));

        static ConversationClient ConversationClientFactory(IServiceProvider provider, object serviceKey) => new(
            provider.GetRequiredService<IHttpClientFactory>().CreateClient(ConversationHttpClientName),
            provider.GetService<ILogger<ConversationClient>>()!
            );

        services.AddKeyedScoped(aadConfigSectionName, ConversationClientFactory);

        return services;
    }
}
