using System.Text.Json.Serialization;

namespace Botas.Schema;

public class Conversation()
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonExtensionData]
    public ExtendedPropertiesDictionary Properties { get; set; } = [];
}
