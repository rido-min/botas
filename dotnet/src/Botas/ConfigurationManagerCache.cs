using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using System.Collections.Concurrent;

namespace Botas;

internal static class ConfigurationManagerCache
{
    private static readonly ConcurrentDictionary<string, IConfigurationManager<OpenIdConnectConfiguration>> _cache = new();

    public static IConfigurationManager<OpenIdConnectConfiguration> GetOrCreate(string metadataAddress, bool requireHttps)
    {
        return _cache.GetOrAdd(metadataAddress, authority =>
        {
            return new ConfigurationManager<OpenIdConnectConfiguration>(
                authority,
                new OpenIdConnectConfigurationRetriever(),
                new HttpDocumentRetriever
                {
                    RequireHttps = requireHttps
                });
        });
    }
}
