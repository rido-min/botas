using System.Text.Json;
using System.Text.Json.Serialization;

namespace Botas;

/// <summary>
/// Teams-specific activity with strongly-typed channel data and helper methods.
/// </summary>
public class TeamsActivity : CoreActivity
{
    [JsonPropertyName("channelData")] public TeamsChannelData? ChannelData { get; set; }
    [JsonPropertyName("timestamp")] public string? Timestamp { get; set; }
    [JsonPropertyName("localTimestamp")] public string? LocalTimestamp { get; set; }
    [JsonPropertyName("locale")] public string? Locale { get; set; }
    [JsonPropertyName("localTimezone")] public string? LocalTimezone { get; set; }
    [JsonPropertyName("suggestedActions")] public SuggestedActions? SuggestedActions { get; set; }

    public new string ToJson() => JsonSerializer.Serialize(this, DefaultJsonOptions);

    /// <summary>
    /// Creates a TeamsActivity from a CoreActivity, converting channel data and accounts.
    /// </summary>
    public static TeamsActivity FromActivity(CoreActivity activity)
    {
        ArgumentNullException.ThrowIfNull(activity);
        var json = activity.ToJson();
        return JsonSerializer.Deserialize<TeamsActivity>(json, DefaultJsonOptions)!;
    }

    /// <summary>
    /// Appends an entity to the Entities collection.
    /// </summary>
    public void AddEntity(Entity entity)
    {
        Entities ??= [];
        var entityJson = JsonSerializer.SerializeToNode(entity, DefaultJsonOptions);
        Entities.Add(entityJson);
    }

    /// <summary>
    /// Returns a new TeamsActivityBuilder.
    /// </summary>
    public static TeamsActivityBuilder CreateBuilder() => new();

    public static new TeamsActivity FromJsonString(string json)
        => JsonSerializer.Deserialize<TeamsActivity>(json, DefaultJsonOptions)!;

    public static new ValueTask<TeamsActivity?> FromJsonStreamAsync(Stream stream, CancellationToken cancellationToken = default)
        => JsonSerializer.DeserializeAsync<TeamsActivity>(stream, DefaultJsonOptions, cancellationToken);
}
