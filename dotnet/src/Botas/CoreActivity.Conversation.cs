using System.Text.Json.Serialization;

namespace Botas;

/// <summary>
/// Identifies a conversation within a channel. Contains the conversation ID and any channel-specific extension properties.
/// </summary>
public class Conversation()
{
    /// <summary>Unique identifier for this conversation within the channel.</summary>
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    /// <summary>Extension data dictionary that preserves unknown JSON properties during round-trip serialization.</summary>
    [JsonExtensionData]
    public Dictionary<string, object?> Properties { get; set; } = [];
}
