using System.Text.Json.Serialization;

namespace Botas;

public class TenantInfo
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}

public class ChannelInfo
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}

public class TeamInfo
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
    [JsonPropertyName("aadGroupId")] public string? AadGroupId { get; set; }
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}

public class MeetingInfo
{
    [JsonPropertyName("id")] public string? Id { get; set; }
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}

public class NotificationInfo
{
    [JsonPropertyName("alert")] public bool? Alert { get; set; }
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}

public class TeamsChannelData
{
    [JsonPropertyName("tenant")] public TenantInfo? Tenant { get; set; }
    [JsonPropertyName("channel")] public ChannelInfo? Channel { get; set; }
    [JsonPropertyName("team")] public TeamInfo? Team { get; set; }
    [JsonPropertyName("meeting")] public MeetingInfo? Meeting { get; set; }
    [JsonPropertyName("notification")] public NotificationInfo? Notification { get; set; }
    [JsonExtensionData] public ExtendedPropertiesDictionary Properties { get; set; } = [];
}
