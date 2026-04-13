using System.Text.Json.Serialization;

namespace Botas;

public class Attachment
{
    [JsonPropertyName("contentType")] public string ContentType { get; set; } = "";
    [JsonPropertyName("contentUrl")] public string? ContentUrl { get; set; }
    [JsonPropertyName("content")] public object? Content { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("thumbnailUrl")] public string? ThumbnailUrl { get; set; }
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}
