using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Botas;

/// <summary>
/// Acquires user-delegated tokens via the Entra Agent ID 3-step token exchange flow.
/// Uses raw HTTP calls — no MSAL dependency — for structural parity with the Node.js and Python implementations.
/// </summary>
/// <remarks>
/// The flow is documented at:
/// https://learn.microsoft.com/en-us/entra/agent-id/identity-platform/agent-user-oauth-flow
///
/// Step 1 — Blueprint acquires FMI exchange token (T1) using fmi_path.
/// Step 2 — Agent Identity acquires impersonation token (T2) using T1 as client_assertion.
/// Step 3 — Agent Identity acquires resource token via user_fic grant with T1 + T2.
/// </remarks>
/// <param name="tenantId">Azure AD tenant ID.</param>
/// <param name="clientId">Blueprint application (client) ID.</param>
/// <param name="clientSecret">Blueprint client secret.</param>
public sealed class AgentTokenClient(string tenantId, string clientId, string clientSecret)
{
    private static readonly HttpClient _http = new();

    private readonly string _tokenEndpoint =
        $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token";

    private const string FmiExchangeScope = "api://AzureADTokenExchange/.default";
    private const string JwtBearerType = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

    private readonly ConcurrentDictionary<string, CachedToken> _cache = new();

    /// <summary>
    /// Acquires a Bearer token for an agent acting as a specific user.
    /// Implements the 3-step agent user identity (user_fic) flow with built-in caching.
    /// </summary>
    /// <param name="agentIdentityId">The Agent Identity ID (dual-purpose: fmi_path in step 1, client_id in steps 2–3).</param>
    /// <param name="agentUserOid">The user OID to impersonate.</param>
    /// <param name="scope">Target resource scope (e.g. <c>"https://api.botframework.com/.default"</c>).</param>
    /// <returns>A string in the format <c>"Bearer {token}"</c>.</returns>
    /// <exception cref="InvalidOperationException">Thrown when the token endpoint returns an error.</exception>
    public async Task<string> GetAgentUserTokenAsync(string agentIdentityId, string agentUserOid, string scope)
    {
        string cacheKey = $"{agentIdentityId}:{agentUserOid}:{scope}";

        if (_cache.TryGetValue(cacheKey, out var cached) && !cached.IsExpired)
        {
            return $"Bearer {cached.AccessToken}";
        }

        string t1 = await Step1_GetFmiExchangeTokenAsync(agentIdentityId).ConfigureAwait(false);
        string t2 = await Step2_GetImpersonationTokenAsync(agentIdentityId, t1).ConfigureAwait(false);
        string resourceToken = await Step3_GetResourceTokenAsync(agentIdentityId, t1, t2, agentUserOid, scope).ConfigureAwait(false);

        _cache[cacheKey] = new CachedToken(resourceToken, DateTimeOffset.UtcNow.AddMinutes(5));

        return $"Bearer {resourceToken}";
    }

    /// <summary>
    /// Step 1: Blueprint acquires FMI exchange token (T1) via fmi_path extension.
    /// </summary>
    private Task<string> Step1_GetFmiExchangeTokenAsync(string agentIdentityId) =>
        PostTokenRequestAsync(new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials",
            ["client_id"] = clientId,
            ["client_secret"] = clientSecret,
            ["scope"] = FmiExchangeScope,
            ["fmi_path"] = agentIdentityId,
        });

    /// <summary>
    /// Step 2: Agent Identity acquires user impersonation token (T2) using T1 as client_assertion.
    /// </summary>
    private Task<string> Step2_GetImpersonationTokenAsync(string agentIdentityId, string t1) =>
        PostTokenRequestAsync(new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials",
            ["client_id"] = agentIdentityId,
            ["client_assertion_type"] = JwtBearerType,
            ["client_assertion"] = t1,
            ["scope"] = FmiExchangeScope,
        });

    /// <summary>
    /// Step 3: Agent Identity acquires the final resource token via user_fic grant.
    /// </summary>
    private Task<string> Step3_GetResourceTokenAsync(string agentIdentityId, string t1, string t2, string agentUserOid, string scope) =>
        PostTokenRequestAsync(new Dictionary<string, string>
        {
            ["grant_type"] = "user_fic",
            ["client_id"] = agentIdentityId,
            ["client_assertion_type"] = JwtBearerType,
            ["client_assertion"] = t1,
            ["user_federated_identity_credential"] = t2,
            ["user_id"] = agentUserOid,
            ["requested_token_use"] = "on_behalf_of",
            ["scope"] = scope,
        });

    private async Task<string> PostTokenRequestAsync(Dictionary<string, string> parameters)
    {
        using var response = await _http.PostAsync(_tokenEndpoint, new FormUrlEncodedContent(parameters)).ConfigureAwait(false);
        var data = await response.Content.ReadFromJsonAsync<TokenResponse>().ConfigureAwait(false)
            ?? throw new InvalidOperationException("Empty response from token endpoint.");

        if (!response.IsSuccessStatusCode || data.Error is not null)
            throw new InvalidOperationException(
                $"Agentic token request failed (HTTP {(int)response.StatusCode}): {data.Error} — {data.ErrorDescription}");

        return data.AccessToken!;
    }

    private sealed class TokenResponse
    {
        [JsonPropertyName("access_token")] public string? AccessToken { get; init; }
        [JsonPropertyName("error")] public string? Error { get; init; }
        [JsonPropertyName("error_description")] public string? ErrorDescription { get; init; }
    }

    private sealed record CachedToken(string AccessToken, DateTimeOffset ExpiresAt)
    {
        public bool IsExpired => DateTimeOffset.UtcNow >= ExpiresAt;
    }
}
