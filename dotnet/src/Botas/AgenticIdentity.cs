namespace Botas;

/// <summary>
/// Value object representing the agentic identity fields extracted from a <see cref="Conversation"/>.
/// When present, indicates that outbound API calls should use the agentic token flow
/// (user-delegated token via Entra Agent ID) instead of standard client credentials.
/// </summary>
public sealed class AgenticIdentity
{
    /// <summary>The Agent Identity's application ID (dual-purpose: <c>fmi_path</c> in step 1, <c>client_id</c> in steps 2–3).</summary>
    public string? AgenticAppId { get; set; }

    /// <summary>The user OID the agent is acting as.</summary>
    public string? AgenticUserId { get; set; }

    /// <summary>The Blueprint's application ID.</summary>
    public string? AgenticAppBlueprintId { get; set; }

    /// <summary>
    /// Extracts an <see cref="AgenticIdentity"/> from a <see cref="Conversation"/> if agentic fields are present.
    /// </summary>
    /// <param name="conversation">The conversation to extract from.</param>
    /// <returns>An <see cref="AgenticIdentity"/> instance, or <c>null</c> if agentic fields are not present.</returns>
    public static AgenticIdentity? FromConversation(Conversation? conversation)
    {
        if (conversation is null)
            return null;

        if (string.IsNullOrEmpty(conversation.AgenticAppId) || string.IsNullOrEmpty(conversation.AgenticUserId))
            return null;

        return new AgenticIdentity
        {
            AgenticAppId = conversation.AgenticAppId,
            AgenticUserId = conversation.AgenticUserId,
            AgenticAppBlueprintId = conversation.AgenticAppBlueprintId,
        };
    }
}
