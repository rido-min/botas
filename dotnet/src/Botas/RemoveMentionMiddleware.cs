using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace Botas;

/// <summary>
/// Middleware that strips @mention text from the incoming activity
/// when the mention refers to the current bot (matched by AppId).
/// After removal the activity text is trimmed of leading/trailing whitespace.
/// </summary>
public class RemoveMentionMiddleware : ITurnMiddleWare
{
    public Task OnTurnAsync(TurnContext context, NextDelegate next, CancellationToken cancellationToken = default)
    {
        RemoveRecipientMention(context);
        return next(cancellationToken);
    }

    internal static void RemoveRecipientMention(TurnContext context)
    {
        var activity = context.Activity;
        if (activity.Entities is null || string.IsNullOrEmpty(activity.Text))
        {
            return;
        }

        string? botId = context.App.AppId ?? activity.Recipient?.Id;
        if (botId is null)
        {
            return;
        }

        foreach (var entity in activity.Entities)
        {
            if (entity is not JsonObject obj)
            {
                continue;
            }

            string? entityType = obj["type"]?.GetValue<string>();
            if (!string.Equals(entityType, "mention", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var mentioned = obj["mentioned"]?.AsObject();
            if (mentioned is null)
            {
                continue;
            }

            string? mentionedId = mentioned["id"]?.GetValue<string>();
            if (!string.Equals(mentionedId, botId, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            // Remove the mention text (e.g. "<at>BotName</at>") from the activity text
            string? mentionText = obj["text"]?.GetValue<string>();
            if (!string.IsNullOrEmpty(mentionText))
            {
                activity.Text = activity.Text!
                    .Replace(mentionText, string.Empty, StringComparison.OrdinalIgnoreCase)
                    .Trim();
            }
        }
    }
}
