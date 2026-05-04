using System.Text.Json.Serialization;

namespace Botas;

/// <summary>
/// Parameters used to create a new conversation via
/// <see cref="ConversationClient.CreateConversationAsync"/>.
/// Mirrors the Bot Framework <c>ConversationParameters</c> object.
/// </summary>
public class ConversationParameters
{
    /// <summary>Whether to create a group conversation.</summary>
    [JsonPropertyName("isGroup")]
    public bool? IsGroup { get; set; }

    /// <summary>Bot account that will participate in the conversation.</summary>
    [JsonPropertyName("bot")]
    public ChannelAccount? Bot { get; set; }

    /// <summary>Initial member list for the conversation.</summary>
    [JsonPropertyName("members")]
    public IList<ChannelAccount>? Members { get; set; }

    /// <summary>Optional topic name for the conversation.</summary>
    [JsonPropertyName("topicName")]
    public string? TopicName { get; set; }

    /// <summary>Tenant ID, when required by the channel (e.g. Microsoft Teams).</summary>
    [JsonPropertyName("tenantId")]
    public string? TenantId { get; set; }

    /// <summary>Initial activity to post when the conversation is created.</summary>
    [JsonPropertyName("activity")]
    public CoreActivity? Activity { get; set; }

    /// <summary>Channel-specific data payload.</summary>
    [JsonPropertyName("channelData")]
    public object? ChannelData { get; set; }

    /// <summary>Extension data dictionary preserving unknown JSON properties on round-trip.</summary>
    [JsonExtensionData]
    public Dictionary<string, object?> Properties { get; set; } = [];
}

/// <summary>
/// Response returned by the Bot Framework after creating a new conversation.
/// </summary>
public class ConversationResourceResponse
{
    /// <summary>Identifier of the newly created conversation.</summary>
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    /// <summary>Service URL where the conversation is hosted.</summary>
    [JsonPropertyName("serviceUrl")]
    public string? ServiceUrl { get; set; }

    /// <summary>ID of the activity that bootstrapped the conversation, when available.</summary>
    [JsonPropertyName("activityId")]
    public string? ActivityId { get; set; }

    /// <summary>Extension data dictionary preserving unknown JSON properties on round-trip.</summary>
    [JsonExtensionData]
    public Dictionary<string, object?> Properties { get; set; } = [];
}
