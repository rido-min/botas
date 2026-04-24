using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Botas;

/// <summary>
/// Core activity type string constants used by <see cref="BotApplication"/> for dispatch.
/// </summary>
public static class ActivityType
{
    /// <summary>A user-to-bot or bot-to-user text message.</summary>
    public const string Message = "message";
    /// <summary>Indicates the sender is typing; shown as a visual indicator in clients.</summary>
    public const string Typing = "typing";
    /// <summary>A synchronous request/response call (e.g. Teams task modules, Adaptive Card actions).</summary>
    public const string Invoke = "invoke";
}

/// <summary>
/// Extended activity type string constants for Teams and other Bot Service channels.
/// Includes all core types plus channel-specific activity types.
/// </summary>
public static class TeamsActivityType
{
    /// <summary>A user-to-bot or bot-to-user text message.</summary>
    public const string Message = ActivityType.Message;
    /// <summary>Indicates the sender is typing; shown as a visual indicator in clients.</summary>
    public const string Typing = ActivityType.Typing;
    /// <summary>A synchronous request/response call (e.g. Teams task modules, Adaptive Card actions).</summary>
    public const string Invoke = ActivityType.Invoke;
    /// <summary>A custom event activity, typically used for proactive notifications.</summary>
    public const string Event = "event";
    /// <summary>Members joined or left the conversation, or the conversation metadata changed.</summary>
    public const string ConversationUpdate = "conversationUpdate";
    /// <summary>An existing message was edited.</summary>
    public const string MessageUpdate = "messageUpdate";
    /// <summary>An existing message was deleted.</summary>
    public const string MessageDelete = "messageDelete";
    /// <summary>A reaction was added to or removed from a message.</summary>
    public const string MessageReaction = "messageReaction";
    /// <summary>The bot was installed or uninstalled in a scope.</summary>
    public const string InstallationUpdate = "installationUpdate";
}

/// <summary>
/// Dictionary that captures unknown JSON properties during deserialization,
/// ensuring they round-trip safely through serialization.
/// Used with <see cref="System.Text.Json.Serialization.JsonExtensionDataAttribute"/>.
/// </summary>
public class ExtendedPropertiesDictionary : Dictionary<string, object?> { }

/// <summary>
/// Represents a Bot Service activity — the fundamental unit of communication between a bot and a channel.
/// Contains typed fields for common properties and an extension dictionary that preserves unknown JSON properties.
/// </summary>
/// <param name="type">The activity type (e.g. <c>"message"</c>, <c>"invoke"</c>, <c>"typing"</c>). Defaults to <c>"message"</c>.</param>
public class CoreActivity(string type = "message")
{
    /// <summary>The activity type (e.g. <c>"message"</c>, <c>"invoke"</c>, <c>"typing"</c>, <c>"event"</c>).</summary>
    [JsonPropertyName("type")] public string Type { get; set; } = type;

    /// <summary>URL of the channel service endpoint to use when sending replies. Required for outbound activities.</summary>
    [JsonPropertyName("serviceUrl")] public string? ServiceUrl { get; set; }

    /// <summary>Name of the operation for invoke activities, or the event name for event activities.</summary>
    [JsonPropertyName("name")] public string? Name { get; set; }

    /// <summary>Open-ended value payload. Used by invoke activities to carry request data and by event activities for event payloads.</summary>
    [JsonPropertyName("value")] public object? Value { get; set; }

    /// <summary>Text content of the activity (the message body for message activities).</summary>
    [JsonPropertyName("text")] public string? Text { get; set; }

    /// <summary>The account that sent this activity.</summary>
    [JsonPropertyName("from")] public ChannelAccount? From { get; set; }

    /// <summary>The intended recipient of this activity.</summary>
    [JsonPropertyName("recipient")] public ChannelAccount? Recipient { get; set; }

    /// <summary>The conversation this activity belongs to.</summary>
    [JsonPropertyName("conversation")] public Conversation? Conversation { get; set; }

    /// <summary>Collection of entities (mentions, places, etc.) associated with this activity.</summary>
    [JsonPropertyName("entities")] public JsonArray? Entities { get; set; }

    /// <summary>Collection of file or rich card attachments on this activity.</summary>
    [JsonPropertyName("attachments")] public JsonArray? Attachments { get; set; }

    /// <summary>Extension data dictionary that preserves unknown JSON properties during round-trip serialization.</summary>
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];

    /// <summary>
    /// Default JSON serializer options used for activity serialization and deserialization.
    /// Configured with indented output, camelCase naming, and null-value omission.
    /// </summary>
    public readonly static JsonSerializerOptions DefaultJsonOptions = new()
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    /// <summary>Serializes this activity to a JSON string using <see cref="DefaultJsonOptions"/>.</summary>
    /// <returns>The JSON representation of this activity.</returns>
    public string ToJson() => JsonSerializer.Serialize(this, GetType(), DefaultJsonOptions);

    /// <summary>Deserializes a <see cref="CoreActivity"/> from a JSON string.</summary>
    /// <param name="json">The JSON string to deserialize.</param>
    /// <returns>The deserialized activity.</returns>
    public static CoreActivity FromJsonString(string json)
        => JsonSerializer.Deserialize<CoreActivity>(json, DefaultJsonOptions)!;

    /// <summary>Asynchronously deserializes a <see cref="CoreActivity"/> from a JSON stream.</summary>
    /// <param name="stream">The stream containing the JSON payload.</param>
    /// <param name="cancellationToken">Token to cancel the operation.</param>
    /// <returns>The deserialized activity, or <c>null</c> if the stream contains a JSON null.</returns>
    public static ValueTask<CoreActivity?> FromJsonStreamAsync(Stream stream, CancellationToken cancellationToken = default)
        => JsonSerializer.DeserializeAsync<CoreActivity>(stream, DefaultJsonOptions, cancellationToken);
}
