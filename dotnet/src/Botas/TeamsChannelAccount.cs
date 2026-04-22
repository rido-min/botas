using System.Text.Json.Serialization;

namespace Botas;

/// <summary>
/// A <see cref="ChannelAccount"/> extended with Microsoft Teams–specific properties
/// such as email address and user principal name.
/// </summary>
public class TeamsChannelAccount : ChannelAccount
{
    /// <summary>The user's email address in the Teams directory.</summary>
    [JsonPropertyName("email")] public string? Email { get; set; }

    /// <summary>The user principal name (UPN) in Azure AD (e.g. <c>"user@contoso.com"</c>).</summary>
    [JsonPropertyName("userPrincipalName")] public string? UserPrincipalName { get; set; }
}
