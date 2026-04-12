using Botas;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.IdentityModel.Tokens;

namespace Botas.E2ETests;

/// <summary>
/// WebApplicationFactory targeting the EchoBot sample with test overrides:
/// - Fake Azure AD config so AddBotApplicationClients doesn't fail at startup
/// - JWT validation overridden to use a local test signing key (no Azure AD calls)
/// - ConversationClient replaced with a plain HttpClient (no token acquisition)
/// </summary>
public sealed class EchoBotFactory : WebApplicationFactory<Program>
{
    static EchoBotFactory()
    {
        // AddBotApplication calls services.BuildServiceProvider() during ConfigureServices,
        // so it reads IConfiguration before WebApplicationFactory.ConfigureWebHost can inject
        // test config. Environment variables are the only reliable way to inject config that
        // early. ASP.NET Core maps __ to : in env var names.
        Environment.SetEnvironmentVariable("AzureAd__ClientId", TestJwt.Audience);
        Environment.SetEnvironmentVariable("AzureAd__TenantId", "test-tenant-id");
        Environment.SetEnvironmentVariable("AzureAd__ClientSecret", "test-secret");
        Environment.SetEnvironmentVariable("AzureAd__AgentScope", "https://api.botframework.com/.default");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {

        builder.ConfigureTestServices(services =>
        {
            // Override JWT validation for both schemes to use the test signing key.
            // PostConfigure runs after all other Configure calls so it takes precedence
            // over the dynamic OnMessageReceived handler that fetches OIDC config from Azure.
            foreach (string scheme in (string[])["Bot", "Agent"])
            {
                services.PostConfigure<JwtBearerOptions>(scheme, options =>
                {
                    options.Audience = TestJwt.Audience;
                    options.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = TestJwt.SigningKey,
                        RequireSignedTokens = true,
                        ValidateIssuer = true,
                        ValidIssuers = [TestJwt.Issuer],
                        ValidateAudience = true,
                        ValidAudiences = [TestJwt.Audience],
                    };
                    // Clear the ConfigurationManager so no OIDC metadata is fetched from Azure
                    options.ConfigurationManager = null;
                    // Clear OnMessageReceived which would otherwise replace ConfigurationManager
                    options.Events = new JwtBearerEvents();
                });
            }

            // Replace ConversationClient with one backed by a plain HttpClient so that
            // outbound SendActivity calls reach the in-process ConversationService without
            // needing real Azure credentials for the BotAuthenticationHandler.
            services.AddKeyedScoped<ConversationClient>("AzureAd", (_, _) =>
                new ConversationClient(
                    new HttpClient(),
                    NullLogger<ConversationClient>.Instance));
        });
    }
}
