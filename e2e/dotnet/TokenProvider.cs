using Microsoft.Identity.Client;

namespace Botas.E2ETests;

/// <summary>
/// Acquires Azure AD tokens using client credentials (CLIENT_ID, CLIENT_SECRET, TENANT_ID env vars).
/// Used by external e2e tests to authenticate against bots running with real Azure AD config.
/// </summary>
public static class TokenProvider
{
    private static IConfidentialClientApplication? _app;

    public static string ClientId => Environment.GetEnvironmentVariable("CLIENT_ID")
        ?? throw new InvalidOperationException("CLIENT_ID environment variable is required for authenticated tests");

    public static string TenantId => Environment.GetEnvironmentVariable("TENANT_ID")
        ?? throw new InvalidOperationException("TENANT_ID environment variable is required for authenticated tests");

    private static string ClientSecret => Environment.GetEnvironmentVariable("CLIENT_SECRET")
        ?? throw new InvalidOperationException("CLIENT_SECRET environment variable is required for authenticated tests");

    public static async Task<string> GetTokenAsync()
    {
        _app ??= ConfidentialClientApplicationBuilder
            .Create(ClientId)
            .WithClientSecret(ClientSecret)
            .WithAuthority($"https://login.microsoftonline.com/{TenantId}")
            .Build();

        AuthenticationResult result = await _app
            .AcquireTokenForClient([$"https://api.botframework.com/.default"])
            .ExecuteAsync();

        return result.AccessToken;
    }
}
