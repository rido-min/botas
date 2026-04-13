using System.Text.Json.Serialization;

namespace Botas;

public class CardAction
{
    [JsonPropertyName("type")] public string Type { get; set; } = "imBack";
    [JsonPropertyName("title")] public string? Title { get; set; }
    [JsonPropertyName("value")] public string? Value { get; set; }
    [JsonPropertyName("text")] public string? Text { get; set; }
    [JsonPropertyName("displayText")] public string? DisplayText { get; set; }
    [JsonPropertyName("image")] public string? Image { get; set; }
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}

public class SuggestedActions
{
    [JsonPropertyName("to")] public string[]? To { get; set; }
    [JsonPropertyName("actions")] public CardAction[] Actions { get; set; } = [];
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}
