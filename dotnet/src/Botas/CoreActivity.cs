using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace Botas;

public class ExtendedPropertiesDictionary : Dictionary<string, object?> { }

public class CoreActivity(string type = "message")
{
    [JsonPropertyName("type")] public string Type { get; set; } = type;
    [JsonPropertyName("serviceUrl")] public string? ServiceUrl { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("value")] public object? Value { get; set; }
    [JsonPropertyName("text")] public string? Text { get; set; }
    [JsonPropertyName("from")] public ChannelAccount? From { get; set; }
    [JsonPropertyName("recipient")] public ChannelAccount? Recipient { get; set; }
    [JsonPropertyName("conversation")] public Conversation? Conversation { get; set; }
    [JsonPropertyName("entities")] public JsonArray? Entities { get; set; }
    [JsonPropertyName("attachments")] public JsonArray? Attachments { get; set; }
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];

    public readonly static JsonSerializerOptions DefaultJsonOptions = new()
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public string ToJson() => JsonSerializer.Serialize(this, GetType(), DefaultJsonOptions);

    public static CoreActivity FromJsonString(string json)
        => JsonSerializer.Deserialize<CoreActivity>(json, DefaultJsonOptions)!;

    public static ValueTask<CoreActivity?> FromJsonStreamAsync(Stream stream, CancellationToken cancellationToken = default)
        => JsonSerializer.DeserializeAsync<CoreActivity>(stream, DefaultJsonOptions, cancellationToken);
}
