using Microsoft.Extensions.Logging;
using System.Text;

namespace Botas;

public class ConversationClient(HttpClient httpClient, ILogger<ConversationClient> logger)
{
    // #107: Allowlist of known Bot Framework service URL patterns to prevent SSRF
    private static readonly string[] AllowedServiceUrlPatterns =
    [
        ".botframework.com",
        ".botframework.us",       // US Government cloud
        ".botframework.cn",       // China cloud
        ".trafficmanager.net",    // Azure Traffic Manager (Teams)
    ];

    public async Task<string> SendActivityAsync(CoreActivity activity, CancellationToken cancellationToken = default)
    {

        if (activity.Type == "trace")
        {
            logger.LogTrace("Skipping trace activity");
            return string.Empty;
        }

        if (activity.Type.Contains("invoke", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogTrace("Skipping invoke activity");
            return string.Empty;
        }

        ValidateServiceUrl(activity.ServiceUrl);

        string url = $"{activity.ServiceUrl!}v3/conversations/{activity.Conversation!.Id}/activities/";
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
            return respContent;
        }

        // Log the full error details server-side for diagnostics
        logger.LogError("Error sending activity to {Url}: {Status} - {Content}", url, resp.StatusCode, respContent);
        
        // Return only a generic error message to the caller to avoid exposing internal service details
        throw new InvalidOperationException($"Error sending activity: {resp.StatusCode}");
    }

    /// <summary>
    /// Validates that the service URL is an HTTPS URL pointing to a known Bot Framework endpoint.
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

        if (!uri.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException($"ServiceUrl must use HTTPS: {serviceUrl}", nameof(serviceUrl));
        }

        string host = uri.Host;
        bool isAllowed = false;
        foreach (string pattern in AllowedServiceUrlPatterns)
        {
            if (host.EndsWith(pattern, StringComparison.OrdinalIgnoreCase))
            {
                isAllowed = true;
                break;
            }
        }

        // Allow localhost for development scenarios
        if (!isAllowed && (host.Equals("localhost", StringComparison.OrdinalIgnoreCase) || host == "127.0.0.1"))
        {
            isAllowed = true;
        }

        if (!isAllowed)
        {
            throw new ArgumentException($"ServiceUrl host is not in the allowed Bot Framework service URL list: {host}", nameof(serviceUrl));
        }
    }
}
