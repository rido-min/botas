using Microsoft.Extensions.Logging;
using System.Text;

namespace Botas;

public class ConversationClient(HttpClient httpClient, ILogger<ConversationClient> logger)
{
    // #107: Allowlist of known Bot Framework service URL patterns to prevent SSRF
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

    public async Task<string> SendActivityAsync(CoreActivity activity, CancellationToken cancellationToken = default)
    {

        if (activity.Type == "trace")
        {
            logger.LogTrace("Skipping trace activity");
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
            throw new ArgumentException($"ServiceUrl host is not in the allowed Bot Framework service URL list: {host}", nameof(serviceUrl));
        }
    }
}
