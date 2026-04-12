using Microsoft.Extensions.Logging;
using Microsoft.Identity.Abstractions;
using Microsoft.Identity.Web;
using System.Net.Http.Headers;

namespace Botas.Hosting;

/// <summary>
/// HTTP message handler that automatically acquires and attaches authentication tokens
/// for Bot Framework API calls using app-only (client credentials) token acquisition.
/// </summary>
/// <remarks>
/// Initializes a new instance of the <see cref="BotAuthenticationHandler"/> class.
/// </remarks>
/// <param name="authorizationHeaderProvider">The authorization header provider for acquiring tokens.</param>
/// <param name="logger">The logger instance.</param>
/// <param name="scope">The scope for the token request.</param>
/// <param name="aadConfigSectionName">The configuration section name for Azure AD settings.</param>
internal class BotAuthenticationHandler(
    IAuthorizationHeaderProvider authorizationHeaderProvider,
    ILogger<BotAuthenticationHandler> logger,
    string scope,
    string aadConfigSectionName = "AzureAd") : DelegatingHandler
{
    private readonly IAuthorizationHeaderProvider _authorizationHeaderProvider = authorizationHeaderProvider ?? throw new ArgumentNullException(nameof(authorizationHeaderProvider));
    private readonly ILogger<BotAuthenticationHandler> _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    private readonly string _scope = scope ?? throw new ArgumentNullException(nameof(scope));
    private readonly string _aadConfigSectionName = aadConfigSectionName ?? throw new ArgumentNullException(nameof(aadConfigSectionName));

    /// <inheritdoc/>
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        string token = await GetAuthorizationHeaderAsync(cancellationToken).ConfigureAwait(false);

        string tokenValue = token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? token["Bearer ".Length..]
            : token;

        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokenValue);

        return await base.SendAsync(request, cancellationToken).ConfigureAwait(false);
    }

    private async Task<string> GetAuthorizationHeaderAsync(CancellationToken cancellationToken)
    {
        AuthorizationHeaderProviderOptions options = new()
        {
            AcquireTokenOptions = new AcquireTokenOptions()
            {
                AuthenticationOptionsName = _aadConfigSectionName,
            }
        };

        _logger.LogDebug("Acquiring app-only token for scope: {Scope}", _scope);
        return await _authorizationHeaderProvider.CreateAuthorizationHeaderForAppAsync(_scope, options, cancellationToken).ConfigureAwait(false);
    }
}
