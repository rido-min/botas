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

    /// <summary>The Agent Identity's application ID, set by the channel when agentic identity should be used for outbound calls.</summary>
    [JsonPropertyName("agenticAppId")]
    public string? AgenticAppId { get; set; }

    /// <summary>The user OID the agent is acting as, set by the channel for user-delegated token flows.</summary>
    [JsonPropertyName("agenticUserId")]
    public string? AgenticUserId { get; set; }

    /// <summary>The Blueprint's application ID, set by the channel to identify the parent app registration.</summary>
    [JsonPropertyName("agenticAppBlueprintId")]
    public string? AgenticAppBlueprintId { get; set; }

    /// <summary>Extension data dictionary that preserves unknown JSON properties during round-trip serialization.</summary>
    [JsonExtensionData]
    public Dictionary<string, object?> Properties { get; set; } = [];
}
