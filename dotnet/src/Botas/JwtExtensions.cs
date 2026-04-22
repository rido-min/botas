using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Microsoft.IdentityModel.Validators;
using System.IdentityModel.Tokens.Jwt;

namespace Botas;


/// <summary>
/// Extension methods for configuring JWT-based Bot Framework authentication and authorization.
/// Supports both single-tenant and multi-tenant bot registration scenarios.
/// </summary>
public static class JwtExtensions
{
    /// <summary>
    /// Adds JWT bearer authentication for a single-tenant bot registration.
    /// Configures two authentication schemes: <c>"Bot"</c> (for Bot Framework tokens)
    /// and <c>"Agent"</c> (for agent-to-agent tokens from the configured tenant).
    /// </summary>
    /// <param name="services">The service collection to configure.</param>
    /// <param name="aadSectionName">The configuration section name for Azure AD settings (default: <c>"AzureAd"</c>).</param>
    /// <returns>The <see cref="AuthenticationBuilder"/> for further configuration.</returns>
    public static AuthenticationBuilder AddBotAuthentication(this IServiceCollection services, string aadSectionName = "AzureAd")
    {
        AuthenticationBuilder authenticationBuilder = services.AddAuthentication();
        
        services.AddOptions<BotAuthenticationOptions>()
            .Configure<IConfiguration>((options, configuration) =>
            {
                options.Audience = configuration[$"{aadSectionName}:ClientId"]!;
                options.TenantId = configuration[$"{aadSectionName}:TenantId"]!;
            });

        IServiceProvider sp = services.BuildServiceProvider();
        BotAuthenticationOptions opts = sp.GetRequiredService<IOptions<BotAuthenticationOptions>>().Value;

        services
            .AddAuthentication()
            .AddCustomJwtBearer("Bot", "botframework.com", opts.Audience)
            .AddCustomJwtBearer("Agent", opts.TenantId, opts.Audience);
        return authenticationBuilder;
    }

    /// <summary>
    /// Adds JWT bearer authentication for a multi-identity bot that serves multiple Azure AD registrations.
    /// Configures a single <c>"BotAndAgentScheme"</c> authentication scheme accepting tokens from any of the configured tenants and audiences.
    /// </summary>
    /// <param name="services">The service collection to configure.</param>
    /// <param name="aadSectionNames">Configuration section names for each Azure AD registration.</param>
    /// <returns>The <see cref="AuthenticationBuilder"/> for further configuration.</returns>
    public static AuthenticationBuilder AddBotAuthenticationEx(this IServiceCollection services, IEnumerable<string> aadSectionNames)
    {
        AuthenticationBuilder authenticationBuilder = services.AddAuthentication();
        
        services.AddOptions<BotAuthenticationMultiOptions>()
            .Configure<IConfiguration>((options, configuration) =>
            {
                foreach (string aadSectionName in aadSectionNames)
                {
                    string audience = configuration[$"{aadSectionName}:ClientId"]!;
                    string tenantId = configuration[$"{aadSectionName}:TenantId"]!;
                    options.Audiences.Add(audience);
                    options.Tenants.Add(tenantId);
                }
            });

        IServiceProvider sp = services.BuildServiceProvider();
        BotAuthenticationMultiOptions opts = sp.GetRequiredService<IOptions<BotAuthenticationMultiOptions>>().Value;

        authenticationBuilder.AddCustomJwtBearerEx("BotAndAgentScheme", opts.Tenants, opts.Audiences);
        return authenticationBuilder;
    }

    /// <summary>
    /// Adds JWT authentication and configures a <c>"DefaultPolicy"</c> authorization policy
    /// that requires an authenticated user via the <c>"Bot"</c> and <c>"Agent"</c> schemes.
    /// </summary>
    /// <param name="services">The service collection to configure.</param>
    /// <returns>The <see cref="AuthorizationBuilder"/> for further policy configuration.</returns>
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

    /// <summary>
    /// Adds a <c>"DefaultPolicy"</c> authorization policy for multi-identity bots,
    /// requiring authentication via the <c>"BotAndAgentScheme"</c>.
    /// </summary>
    /// <param name="services">The service collection to configure.</param>
    /// <returns>The <see cref="AuthorizationBuilder"/> for further policy configuration.</returns>
    public static AuthorizationBuilder AddBotAuthorizationEx(this IServiceCollection services)
    {
        AuthorizationBuilder authorizationBuilder = services.AddAuthorizationBuilder();
        authorizationBuilder = authorizationBuilder.AddDefaultPolicy("DefaultPolicy", policy =>
        {
            policy.AuthenticationSchemes.Add("BotAndAgentScheme");
            policy.RequireAuthenticatedUser();
        });
        return authorizationBuilder;
    }


    /// <summary>
    /// Adds a JWT bearer authentication scheme configured for Bot Framework token validation.
    /// Dynamically resolves the OIDC metadata endpoint based on the token's issuer claim.
    /// </summary>
    /// <param name="builder">The authentication builder to extend.</param>
    /// <param name="schemeName">A unique name for this authentication scheme (e.g. <c>"Bot"</c>, <c>"Agent"</c>).</param>
    /// <param name="tenantId">The Azure AD tenant ID, or <c>"botframework.com"</c> for the Bot Framework issuer.</param>
    /// <param name="audience">The expected audience (typically the bot's Azure AD client ID).</param>
    /// <returns>The <see cref="AuthenticationBuilder"/> for chaining.</returns>
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
                     else if (!string.IsNullOrEmpty(tid) && tid.Equals(tenantId, StringComparison.OrdinalIgnoreCase))
                     {
                         oidcAuthority = $"https://login.microsoftonline.com/{tenantId}/v2.0/.well-known/openid-configuration";
                     }
                     else
                     {
                         context.Fail("Token tenant ID does not match the configured tenant.");
                         return Task.CompletedTask;
                     }

                     jwtOptions.ConfigurationManager = ConfigurationManagerCache.GetOrCreate(
                         oidcAuthority,
                         jwtOptions.RequireHttpsMetadata);

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
    /// Adds a JWT bearer authentication scheme that accepts tokens from multiple tenants and audiences.
    /// Used for multi-identity bots that serve several Azure AD registrations.
    /// </summary>
    /// <param name="builder">The authentication builder to extend.</param>
    /// <param name="schemeName">A unique name for this authentication scheme.</param>
    /// <param name="tenants">The set of allowed Azure AD tenant IDs.</param>
    /// <param name="audiences">The set of allowed audiences (client IDs).</param>
    /// <returns>The <see cref="AuthenticationBuilder"/> for chaining.</returns>
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

                    // Cache ConfigurationManager instances by authority to avoid recreating on every request
                    jwtOptions.ConfigurationManager = ConfigurationManagerCache.GetOrCreate(
                        oidcAuthority,
                        jwtOptions.RequireHttpsMetadata);

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
