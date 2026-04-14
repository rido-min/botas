namespace Botas;

internal sealed class BotAuthenticationMultiOptions
{
    public List<string> Audiences { get; } = [];
    public List<string> Tenants { get; } = [];
}
