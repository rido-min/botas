using Microsoft.Extensions.Logging;

namespace Botas.State;

/// <summary>
/// Middleware that loads state at turn start and saves it at turn end.
/// State is only saved if the handler/middleware chain completes successfully without exceptions.
/// </summary>
internal class StateMiddleware : ITurnMiddleWare
{
    private readonly IStorage _storage;
    private readonly ILogger? _logger;

    public StateMiddleware(IStorage storage, ILogger? logger = null)
    {
        _storage = storage;
        _logger = logger;
    }

    public async Task OnTurnAsync(TurnContext context, NextDelegate next, CancellationToken cancellationToken = default)
    {
        // Load state at turn start
        TurnState state;
        try
        {
            state = await LoadStateAsync(context.Activity, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Failed to load state for conversation {ConversationId}", context.Activity.Conversation?.Id);
            throw new StateLoadException("Failed to load state from storage", ex);
        }

        // Attach state to context
        context.SetState(state);

        // Call next middleware/handler
        Exception? thrownException = null;
        try
        {
            await next(cancellationToken);
        }
        catch (Exception ex)
        {
            // Capture exception but don't save state
            thrownException = ex;
        }

        // Save state ONLY if next() succeeded (no exception)
        if (thrownException is null)
        {
            try
            {
                await SaveStateAsync(state, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger?.LogError(ex, "Failed to save state for conversation {ConversationId}", context.Activity.Conversation?.Id);
                throw new StateSaveException("Failed to save state to storage", ex);
            }
        }
        else
        {
            // Re-throw the original exception (state changes are discarded)
            throw thrownException;
        }
    }

    private async Task<TurnState> LoadStateAsync(CoreActivity activity, CancellationToken cancellationToken)
    {
        // Derive storage keys from activity
        var conversationKey = GetConversationKey(activity);
        var userKey = GetUserKey(activity);

        // Load from storage
        var keys = new List<string>();
        if (conversationKey is not null) keys.Add(conversationKey);
        if (userKey is not null) keys.Add(userKey);

        var loaded = await _storage.ReadAsync(keys.ToArray(), cancellationToken);

        // Extract loaded data or use empty dictionaries
        var conversationData = ExtractData(loaded, conversationKey);
        var userData = ExtractData(loaded, userKey);
        var tempData = new Dictionary<string, object?>();

        return new TurnState(conversationKey, userKey, conversationData, userData, tempData);
    }

    private async Task SaveStateAsync(TurnState state, CancellationToken cancellationToken)
    {
        var (changes, deletions) = state.GetChanges();

        // Save changes and deletions in parallel
        var tasks = new List<Task>();
        if (changes.Count > 0)
        {
            tasks.Add(_storage.WriteAsync(changes, cancellationToken));
        }
        if (deletions.Length > 0)
        {
            tasks.Add(_storage.DeleteAsync(deletions, cancellationToken));
        }

        if (tasks.Count > 0)
        {
            await Task.WhenAll(tasks);
        }
    }

    private static Dictionary<string, object?> ExtractData(IDictionary<string, object> loaded, string? key)
    {
        if (key is null || !loaded.TryGetValue(key, out var value))
        {
            return new Dictionary<string, object?>();
        }

        if (value is Dictionary<string, object?> dict)
        {
            return dict;
        }

        // Try to cast to Dictionary<string, object>
        if (value is Dictionary<string, object> dictObj)
        {
            // Convert to Dictionary<string, object?>
            var result = new Dictionary<string, object?>();
            foreach (var kvp in dictObj)
            {
                result[kvp.Key] = kvp.Value;
            }
            return result;
        }

        return new Dictionary<string, object?>();
    }

    private static string? GetConversationKey(CoreActivity activity)
    {
        var channelId = activity.ChannelId;
        var botId = activity.Recipient?.Id;
        var conversationId = activity.Conversation?.Id;

        if (string.IsNullOrEmpty(channelId) || string.IsNullOrEmpty(botId) || string.IsNullOrEmpty(conversationId))
        {
            return null;
        }

        return $"{channelId}/{botId}/conversations/{conversationId}";
    }

    private static string? GetUserKey(CoreActivity activity)
    {
        var channelId = activity.ChannelId;
        var botId = activity.Recipient?.Id;
        var userId = activity.From?.Id;

        if (string.IsNullOrEmpty(channelId) || string.IsNullOrEmpty(botId) || string.IsNullOrEmpty(userId))
        {
            return null;
        }

        return $"{channelId}/{botId}/users/{userId}";
    }
}
