using System.Text.Json.Serialization;

namespace Botas;

/// <summary>
/// Represents a semantic entity (mention, place, thing, etc.) attached to an activity.
/// The <see cref="Type"/> discriminates the entity kind; additional data is captured in <see cref="Properties"/>.
/// </summary>
public class Entity
{
    /// <summary>Entity type (e.g. <c>"mention"</c>, <c>"Place"</c>, <c>"clientInfo"</c>).</summary>
    [JsonPropertyName("type")] public string Type { get; set; } = "";

    /// <summary>Extension data dictionary that preserves unknown JSON properties during round-trip serialization.</summary>
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}
