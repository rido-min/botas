using System.Text.Json.Serialization;

namespace Botas;

/// <summary>
/// Represents an actionable button that can be presented to the user.
/// Used within <see cref="SuggestedActions"/> or as part of card content.
/// </summary>
public class CardAction
{
    /// <summary>Action type (e.g. <c>"imBack"</c>, <c>"postBack"</c>, <c>"openUrl"</c>, <c>"messageBack"</c>). Defaults to <c>"imBack"</c>.</summary>
    [JsonPropertyName("type")] public string Type { get; set; } = "imBack";

    /// <summary>Text displayed on the button.</summary>
    [JsonPropertyName("title")] public string? Title { get; set; }

    /// <summary>Value sent to the bot when the action is triggered.</summary>
    [JsonPropertyName("value")] public string? Value { get; set; }

    /// <summary>Text sent to the bot as a message when the action is triggered (for <c>"imBack"</c> and <c>"postBack"</c>).</summary>
    [JsonPropertyName("text")] public string? Text { get; set; }

    /// <summary>Text displayed in the chat feed after the action is triggered.</summary>
    [JsonPropertyName("displayText")] public string? DisplayText { get; set; }

    /// <summary>URL of an image to display on the button.</summary>
    [JsonPropertyName("image")] public string? Image { get; set; }

    /// <summary>Extension data dictionary that preserves unknown JSON properties during round-trip serialization.</summary>
    [JsonExtensionData] public Dictionary<string, object?> Properties { get; set; } = [];
}

/// <summary>
/// A set of suggested actions that the channel can present to the user as quick-reply buttons.
/// </summary>
public class SuggestedActions
{
    /// <summary>Array of user IDs that should receive the suggested actions. When <c>null</c>, all participants see them.</summary>
    [JsonPropertyName("to")] public string[]? To { get; set; }

    /// <summary>The card actions to present as suggested responses.</summary>
    [JsonPropertyName("actions")] public CardAction[] Actions { get; set; } = [];

    /// <summary>Extension data dictionary that preserves unknown JSON properties during round-trip serialization.</summary>
    [JsonExtensionData] public Dictionary<string, object?> Properties { get; set; } = [];
}
