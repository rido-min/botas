using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Microsoft.IdentityModel.Validators;
using System.IdentityModel.Tokens.Jwt;

namespace Botas;


public static class JwtExtensions
{
    public static AuthenticationBuilder AddBotAuthentication(this IServiceCollection services, string aadSectionName = "AzureAd")
    {
        AuthenticationBuilder authenticationBuilder = services.AddAuthentication();
        IConfiguration configuration = services.BuildServiceProvider().GetRequiredService<IConfiguration>();
        //string agentScope = configuration[$"{aadSectionName}:AgentScope"]!;
        string audience = configuration[$"{aadSectionName}:ClientId"]!;
        string tenantId = configuration[$"{aadSectionName}:TenantId"]!;

        services
            .AddAuthentication()
            .AddCustomJwtBearer("Bot", "botframework.com", audience)
            .AddCustomJwtBearer("Agent", tenantId, audience);
        return authenticationBuilder;
    }

    public static AuthenticationBuilder AddBotAuthenticationEx(this IServiceCollection services, IEnumerable<string> aadSectionNames)
    {
        AuthenticationBuilder authenticationBuilder = services.AddAuthentication();
        List<string> audiences = [];
        List<string> tenants = [];
        foreach (string aadSectionName in aadSectionNames)
        {
            IConfiguration configuration = services.BuildServiceProvider().GetRequiredService<IConfiguration>();
            // string agentScope = configuration[$"{aadSectionName}:AgentScope"]!;
            string audience = configuration[$"{aadSectionName}:ClientId"]!;
            string tenantId = configuration[$"{aadSectionName}:TenantId"]!;
            audiences.Add(audience);
            tenants.Add(tenantId);
        }
        authenticationBuilder.AddCustomJwtBearerEx("BotAndAgentScheme", tenants, audiences);
        return authenticationBuilder;
    }

    public static AuthorizationBuilder AddBotAuthorization(this IServiceCollection services)
    {
        services.AddBotAuthentication();
        AuthorizationBuilder authorizationBuilder = services
            .AddAuthorizationBuilder()
            .AddDefaultPolicy("DefaultPolicy", policy =>
            {
                policy.AuthenticationSchemes.Add("Bot");
                policy.AuthenticationSchemes.Add("Agent");
                policy.RequireAuthenticatedUser();
            });
        return authorizationBuilder;
    }

    public static AuthorizationBuilder AddBotAuthorizationEx(this IServiceCollection services)
    {
        IConfiguration configuration = services.BuildServiceProvider().GetRequiredService<IConfiguration>();

        AuthorizationBuilder authorizationBuilder = services.AddAuthorizationBuilder();
        authorizationBuilder = authorizationBuilder.AddDefaultPolicy("DefaultPolicy", policy =>
        {
            policy.AuthenticationSchemes.Add("BotAndAgentScheme");
            policy.RequireAuthenticatedUser();
        });
        return authorizationBuilder;
    }


    public static AuthenticationBuilder AddCustomJwtBearer(this AuthenticationBuilder builder, string schemeName, string tenantId, string audience)
    {
        //string metadataAddress = tenantId.Equals("botframework.com", StringComparison.OrdinalIgnoreCase)
        //    ? "https://login.botframework.com/v1/.well-known/openidconfiguration"
        //    : $"https://login.microsoftonline.com/{tenantId}/v2.0/.well-known/openid-configuration";

        string[] validIssuers = tenantId.Equals("botframework.com", StringComparison.OrdinalIgnoreCase)
            ? ["https://api.botframework.com"]
            : [$"https://sts.windows.net/{tenantId}/", $"https://login.microsoftonline.com/{tenantId}/v2", "https://api.botframework.com"];

        builder.AddJwtBearer(schemeName, jwtOptions =>
         {
             jwtOptions.SaveToken = true;
             jwtOptions.IncludeErrorDetails = false; // #100: Don't leak validation internals to clients
             jwtOptions.TokenValidationParameters = new TokenValidationParameters
             {
                 ValidAudiences = [audience, $"api://{audience}", "https://api.botframework.com"],
                 ValidateIssuerSigningKey = true,
                 RequireSignedTokens = true,
                 ValidateIssuer = true,
                 ValidateAudience = true,
                 ValidIssuers = validIssuers
             };
             jwtOptions.TokenValidationParameters.EnableAadSigningKeyIssuerValidation();
             jwtOptions.MapInboundClaims = true;
             jwtOptions.Events = new JwtBearerEvents
             {
                 OnMessageReceived = async context =>
                 {
                     string authorizationHeader = context.Request.Headers.Authorization.ToString();

                     if (string.IsNullOrEmpty(authorizationHeader))
                     {
                         context.Options.TokenValidationParameters.ConfigurationManager ??= jwtOptions.ConfigurationManager as BaseConfigurationManager;
                         await Task.CompletedTask.ConfigureAwait(false);
                         return;
                     }

                     string[] parts = authorizationHeader?.Split(' ')!;
                     if (parts.Length != 2 || parts[0] != "Bearer")
                     {
                         context.Options.TokenValidationParameters.ConfigurationManager ??= jwtOptions.ConfigurationManager as BaseConfigurationManager;
                         await Task.CompletedTask.ConfigureAwait(false);
                         return;
                     }

                     JwtSecurityToken token = new(parts[1]);
                     string issuer = token.Claims.FirstOrDefault(claim => claim.Type == "iss")?.Value!;
                     string tid = token.Claims.FirstOrDefault(claim => claim.Type == "tid")?.Value!;

                     // #99: Validate issuer against known Bot Framework issuers before constructing OIDC authority
                     if (!IsKnownIssuer(issuer, validIssuers))
                     {
                         context.Fail("Token issuer is not in the allowed issuers list.");
                         return;
                     }

                     string oidcAuthority;
                     if (issuer.Equals("https://api.botframework.com", StringComparison.OrdinalIgnoreCase))
                     {
                         oidcAuthority = "https://login.botframework.com/v1/.well-known/openid-configuration";
                     }
                     else if (!string.IsNullOrEmpty(tid) && tid.Equals(tenantId, StringComparison.OrdinalIgnoreCase))
                     {
                         oidcAuthority = $"https://login.microsoftonline.com/{tenantId}/v2.0/.well-known/openid-configuration";
                     }
                     else
                     {
                         context.Fail("Token tenant ID does not match the configured tenant.");
                         return;
                     }

                     jwtOptions.ConfigurationManager = new ConfigurationManager<OpenIdConnectConfiguration>(
                         oidcAuthority,
                         new OpenIdConnectConfigurationRetriever(),
                         new HttpDocumentRetriever
                         {
                             RequireHttps = jwtOptions.RequireHttpsMetadata
                         });

                     await Task.CompletedTask.ConfigureAwait(false);
                 },
                 OnTokenValidated = context =>
                 {
                     return Task.CompletedTask;
                 },
                 OnForbidden = context =>
                 {
                     return Task.CompletedTask;
                 },
                 OnAuthenticationFailed = context =>
                 {
                     return Task.CompletedTask;
                 }
             };
             jwtOptions.Validate();
         });
        return builder;
    }

    public static AuthenticationBuilder AddCustomJwtBearerEx(this AuthenticationBuilder builder, string schemeName, IEnumerable<string> tenants, IEnumerable<string> audiences)
    {
        List<string> validIssuers = ["https://api.botframework.com"];
        HashSet<string> allowedTenants = new(StringComparer.OrdinalIgnoreCase);

        foreach (string tenantId in tenants)
        {
            allowedTenants.Add(tenantId);
            validIssuers.Add($"https://sts.windows.net/{tenantId}/");
            validIssuers.Add($"https://login.microsoftonline.com/{tenantId}/v2");
        }

        builder.AddJwtBearer(schemeName, jwtOptions =>
        {
            jwtOptions.SaveToken = true;
            jwtOptions.IncludeErrorDetails = false; // #100: Don't leak validation internals to clients
            jwtOptions.TokenValidationParameters = new TokenValidationParameters
            {
                ValidAudiences = audiences,
                ValidateIssuerSigningKey = true,
                RequireSignedTokens = true,
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidIssuers = validIssuers
            };
            jwtOptions.TokenValidationParameters.EnableAadSigningKeyIssuerValidation();
            jwtOptions.MapInboundClaims = true;
            jwtOptions.Events = new JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    string authorizationHeader = context.Request.Headers.Authorization.ToString();

                    if (string.IsNullOrEmpty(authorizationHeader))
                    {
                        context.Options.TokenValidationParameters.ConfigurationManager ??= jwtOptions.ConfigurationManager as BaseConfigurationManager;
                        return Task.CompletedTask;
                    }

                    string[] parts = authorizationHeader?.Split(' ')!;
                    if (parts.Length != 2 || parts[0] != "Bearer")
                    {
                        context.Options.TokenValidationParameters.ConfigurationManager ??= jwtOptions.ConfigurationManager as BaseConfigurationManager;
                        return Task.CompletedTask;
                    }

                    JwtSecurityToken token = new(parts[1]);
                    string issuer = token.Claims.FirstOrDefault(claim => claim.Type == "iss")?.Value!;
                    string tid = token.Claims.FirstOrDefault(claim => claim.Type == "tid")?.Value!;

                    // #99: Validate issuer against known Bot Framework issuers before constructing OIDC authority
                    if (!IsKnownIssuer(issuer, validIssuers))
                    {
                        context.Fail("Token issuer is not in the allowed issuers list.");
                        return Task.CompletedTask;
                    }

                    string oidcAuthority;
                    if (issuer.Equals("https://api.botframework.com", StringComparison.OrdinalIgnoreCase))
                    {
                        oidcAuthority = "https://login.botframework.com/v1/.well-known/openid-configuration";
                    }
                    else if (!string.IsNullOrEmpty(tid) && allowedTenants.Contains(tid))
                    {
                        oidcAuthority = $"https://login.microsoftonline.com/{tid}/v2.0/.well-known/openid-configuration";
                    }
                    else
                    {
                        context.Fail("Token tenant ID does not match any configured tenant.");
                        return Task.CompletedTask;
                    }

                    jwtOptions.ConfigurationManager = new ConfigurationManager<OpenIdConnectConfiguration>(
                        oidcAuthority,
                        new OpenIdConnectConfigurationRetriever(),
                        new HttpDocumentRetriever
                        {
                            RequireHttps = jwtOptions.RequireHttpsMetadata
                        });

                    return Task.CompletedTask;
                },
                OnTokenValidated = context =>
                {
                    return Task.CompletedTask;
                },
                OnForbidden = context =>
                {
                    return Task.CompletedTask;
                },
                OnAuthenticationFailed = context =>
                {
                    return Task.CompletedTask;
                }
            };
            jwtOptions.Validate();
        });
        return builder;
    }


    /// <summary>
    /// Validates that a token issuer matches one of the known valid issuers.
    /// </summary>
    internal static bool IsKnownIssuer(string issuer, IEnumerable<string> validIssuers)
    {
        if (string.IsNullOrEmpty(issuer)) return false;
        return validIssuers.Any(vi => vi.Equals(issuer, StringComparison.OrdinalIgnoreCase));
    }
}
