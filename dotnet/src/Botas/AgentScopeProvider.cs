namespace Botas;

internal sealed class AgentScopeProvider(string scope)
{
    public string Scope { get; } = scope;
}
