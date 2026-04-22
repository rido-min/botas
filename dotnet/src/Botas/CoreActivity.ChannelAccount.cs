using System.Text.Json.Serialization;

namespace Botas;

/// <summary>
/// Identifies a user, bot, or other participant in a conversation.
/// </summary>
public class ChannelAccount()
{
    /// <summary>Unique identifier for this account within the channel.</summary>
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    /// <summary>Display name for this account.</summary>
    [JsonPropertyName("name")]
    public string? Name { get; set; }

    /// <summary>Azure Active Directory object ID for this account, if available.</summary>
    [JsonPropertyName("aadObjectId")]
    public string? AadObjectId { get; set; }

    /// <summary>Role of the account (e.g. <c>"bot"</c> or <c>"user"</c>).</summary>
    [JsonPropertyName("role")]
    public string? Role { get; set; }

    /// <summary>Extension data dictionary that preserves unknown JSON properties during round-trip serialization.</summary>
    [JsonExtensionData]
    public ExtendedPropertiesDictionary Properties { get; set; } = [];
}
