namespace Botas;

/// <summary>
/// Context for a single activity turn, passed to handlers and middleware.
/// Provides the incoming activity, a reference to the bot application,
/// and a scoped <see cref="SendAsync(string, CancellationToken)"/> method
/// that automatically routes replies back to the originating conversation.
/// </summary>
public class TurnContext
{
    /// <summary>The incoming activity being processed.</summary>
    public CoreActivity Activity { get; }

    /// <summary>The BotApplication instance processing this turn.</summary>
    public BotApplication App { get; }

    internal TurnContext(BotApplication app, CoreActivity activity)
    {
        App = app;
        Activity = activity;
    }

    /// <summary>
    /// Send a text reply to the conversation that originated this turn.
    /// </summary>
    public Task<string> SendAsync(string text, CancellationToken cancellationToken = default)
    {
        var reply = new CoreActivityBuilder()
            .WithConversationReference(Activity)
            .WithText(text)
            .Build();
        return App.SendActivityAsync(reply, cancellationToken);
    }

    /// <summary>
    /// Send a custom activity reply to the conversation that originated this turn.
    /// Routing fields are populated from the incoming activity if not already set.
    /// </summary>
    public Task<string> SendAsync(CoreActivity activity, CancellationToken cancellationToken = default)
    {
        activity.ServiceUrl ??= Activity.ServiceUrl;
        activity.Conversation ??= Activity.Conversation;
        activity.From ??= Activity.Recipient;
        activity.Recipient ??= Activity.From;
        return App.SendActivityAsync(activity, cancellationToken);
    }
}
