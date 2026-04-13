using System.Text.Json.Serialization;

namespace Botas;

public class Entity
{
    [JsonPropertyName("type")] public string Type { get; set; } = "";
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}
