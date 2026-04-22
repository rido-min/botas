using System.Text.Json.Serialization;

namespace Botas;

/// <summary>
/// Represents a file or rich card attachment on a Bot Framework activity.
/// </summary>
public class Attachment
{
    /// <summary>MIME type of the attachment content (e.g. <c>"image/png"</c>, <c>"application/vnd.microsoft.card.adaptive"</c>).</summary>
    [JsonPropertyName("contentType")] public string ContentType { get; set; } = "";

    /// <summary>URL to the attachment content. Used when the content is hosted externally.</summary>
    [JsonPropertyName("contentUrl")] public string? ContentUrl { get; set; }

    /// <summary>Inline attachment content. For Adaptive Cards this is the card JSON object.</summary>
    [JsonPropertyName("content")] public object? Content { get; set; }

    /// <summary>Display name of the attachment.</summary>
    [JsonPropertyName("name")] public string? Name { get; set; }

    /// <summary>URL to a thumbnail image for the attachment.</summary>
    [JsonPropertyName("thumbnailUrl")] public string? ThumbnailUrl { get; set; }

    /// <summary>Extension data dictionary that preserves unknown JSON properties during round-trip serialization.</summary>
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}
