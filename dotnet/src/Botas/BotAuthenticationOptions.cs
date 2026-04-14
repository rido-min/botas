namespace Botas;

internal sealed class BotAuthenticationOptions
{
    public string Audience { get; set; } = string.Empty;
    public string TenantId { get; set; } = string.Empty;
}
