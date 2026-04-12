using Microsoft.Extensions.Logging;
using Botas.Schema;
using System.Text;

namespace Botas;

public class ConversationClient(HttpClient httpClient, ILogger<ConversationClient> logger)
{
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
        logger.LogTrace("Response Status {Status}, content {Content}", resp.StatusCode, respContent);

        return resp.IsSuccessStatusCode ?
            respContent :
            throw new InvalidOperationException($"Error sending activity: {resp.StatusCode} - {respContent}");
    }
}
