using Microsoft.Extensions.Logging;
using System.Diagnostics;
using System.Text;

namespace Botas;

/// <summary>
/// HTTP client for sending outbound activities to the Bot Service channel service.
/// Handles SSRF protection by validating service URLs against a known allowlist.
/// </summary>
/// <param name="httpClient">The HTTP client (typically configured with an authentication handler for outbound tokens).</param>
/// <param name="logger">Logger instance for diagnostic output.</param>
public class ConversationClient(HttpClient httpClient, ILogger<ConversationClient> logger)
{
    // #107: Allowlist of known Bot Service service URL patterns to prevent SSRF
    // Suffix patterns (host must end with these)
    private static readonly string[] AllowedServiceUrlSuffixes =
    [
        ".botframework.com",
        ".botframework.us",       // US Government cloud
        ".botframework.cn",       // China cloud
    ];

    // Exact hostname matches
    private static readonly string[] AllowedServiceUrlExactHosts =
    [
        "smba.trafficmanager.net",    // Azure Traffic Manager (Teams)
    ];

    /// <summary>
    /// Sends an activity to the Bot Service channel service via the REST API.
    /// The service URL is validated against an allowlist before sending.
    /// </summary>
    /// <param name="activity">The activity to send. Must have <c>ServiceUrl</c> and <c>Conversation.Id</c> set.</param>
    /// <param name="cancellationToken">Token to cancel the operation.</param>
    /// <returns>The raw JSON response body on success.</returns>
    /// <exception cref="ArgumentException">Thrown when the <c>ServiceUrl</c> is missing or not in the allowed list.</exception>
    /// <exception cref="InvalidOperationException">Thrown when the Bot Service service returns a non-success status code.</exception>
    public async Task<string> SendActivityAsync(CoreActivity activity, CancellationToken cancellationToken = default)
    {

        ValidateServiceUrl(activity.ServiceUrl);

        BotMeter.OutboundCalls.Add(1, new KeyValuePair<string, object?>("operation", "sendActivity"));

        using var ccActivity = BotActivitySource.Source.StartActivity("botas.conversation_client");
        ccActivity?.SetTag("conversation.id", activity.Conversation?.Id ?? "");
        ccActivity?.SetTag("activity.type", activity.Type ?? "");
        ccActivity?.SetTag("service.url", activity.ServiceUrl ?? "");

        try
        {
            string url = $"{activity.ServiceUrl!}v3/conversations/{Uri.EscapeDataString(activity.Conversation!.Id!)}/activities/";
            string body = activity.ToJson();

            HttpRequestMessage request = new(HttpMethod.Post, url)
            {
                Content = new StringContent(body, Encoding.UTF8, "application/json")
            };

            if (logger.IsEnabled(LogLevel.Trace))
            {
                logger.LogTrace("\n POST {Url} \n\n", url);
                logger.LogTrace("Body: \n {Body} \n", body);
            }

            using HttpResponseMessage resp = await httpClient.SendAsync(request, cancellationToken).ConfigureAwait(false);

            string respContent = await resp.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);

            if (resp.IsSuccessStatusCode)
            {
                logger.LogTrace("Response Status {Status}, content {Content}", resp.StatusCode, respContent);
                ccActivity?.SetTag("activity.id", respContent);
                return respContent;
            }

            // Log the full error details server-side for diagnostics
            logger.LogError("Error sending activity to {Url}: {Status} - {Content}", url, resp.StatusCode, respContent);

            // Return only a generic error message to the caller to avoid exposing internal service details
            throw new InvalidOperationException($"Error sending activity: {resp.StatusCode}");
        }
        catch (Exception ex) when (ccActivity is not null)
        {
            ccActivity.SetStatus(ActivityStatusCode.Error, ex.Message);
            BotMeter.OutboundErrors.Add(1, new KeyValuePair<string, object?>("operation", "sendActivity"));
            throw;
        }
    }

    /// <summary>
    /// Validates that the service URL is an HTTPS URL pointing to a known Bot Service endpoint.
    /// Prevents SSRF by rejecting URLs that could target internal services.
    /// </summary>
    internal static void ValidateServiceUrl(string? serviceUrl)
    {
        if (string.IsNullOrEmpty(serviceUrl))
        {
            throw new ArgumentException("ServiceUrl is required.", nameof(serviceUrl));
        }

        if (!Uri.TryCreate(serviceUrl, UriKind.Absolute, out Uri? uri))
        {
            throw new ArgumentException($"ServiceUrl is not a valid absolute URI: {serviceUrl}", nameof(serviceUrl));
        }

        string host = uri.Host;

        // Allow localhost for development scenarios (HTTP or HTTPS)
        if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase) || host == "127.0.0.1")
        {
            return;
        }

        if (!uri.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException($"ServiceUrl must use HTTPS: {serviceUrl}", nameof(serviceUrl));
        }

        bool isAllowed = false;
        foreach (string suffix in AllowedServiceUrlSuffixes)
        {
            if (host.EndsWith(suffix, StringComparison.OrdinalIgnoreCase))
            {
                isAllowed = true;
                break;
            }
        }

        if (!isAllowed)
        {
            foreach (string exactHost in AllowedServiceUrlExactHosts)
            {
                if (host.Equals(exactHost, StringComparison.OrdinalIgnoreCase))
                {
                    isAllowed = true;
                    break;
                }
            }
        }

        // Check ALLOWED_SERVICE_URLS environment variable (comma-separated URL prefixes)
        if (!isAllowed)
        {
            string? envUrls = Environment.GetEnvironmentVariable("ALLOWED_SERVICE_URLS");
            if (!string.IsNullOrEmpty(envUrls))
            {
                foreach (string entry in envUrls.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                {
                    if (serviceUrl.StartsWith(entry, StringComparison.OrdinalIgnoreCase))
                    {
                        isAllowed = true;
                        break;
                    }
                }
            }
        }

        if (!isAllowed)
        {
            throw new ArgumentException($"ServiceUrl host is not in the allowed Bot Service service URL list: {host}", nameof(serviceUrl));
        }
    }
}
