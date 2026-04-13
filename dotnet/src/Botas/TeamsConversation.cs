using System.Text.Json.Serialization;

namespace Botas;

public class TeamsConversation : Conversation
{
    [JsonPropertyName("conversationType")] public string? ConversationType { get; set; }
    [JsonPropertyName("tenantId")] public string? TenantId { get; set; }
    [JsonPropertyName("isGroup")] public bool? IsGroup { get; set; }
    [JsonPropertyName("name")] public string? Name { get; set; }
}
