using System.Text.Json.Serialization;

namespace Botas.Schema;

public class ChannelAccount()
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("name")]
    public string? Name { get; set; }

    [JsonPropertyName("aadObjectId")]
    public string? AadObjectId { get; set; }

    [JsonPropertyName("role")]
    public string? Role { get; set; }

    [JsonExtensionData]
    public ExtendedPropertiesDictionary Properties { get; set; } = [];
}
