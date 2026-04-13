using System.Text.Json.Serialization;

namespace Botas;

public class TeamsChannelAccount : ChannelAccount
{
    [JsonPropertyName("email")] public string? Email { get; set; }
    [JsonPropertyName("userPrincipalName")] public string? UserPrincipalName { get; set; }
}
