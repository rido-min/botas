using System.Text.Json;

namespace Botas.State;

/// <summary>
/// State container for a single turn, providing scoped access to
/// conversation, user, and temporary state.
/// </summary>
public class TurnState
{
    private readonly StateScope _conversation;
    private readonly StateScope _user;
    private readonly StateScope _temp;

    private readonly string? _conversationKey;
    private readonly string? _userKey;
    private readonly string? _conversationHash;
    private readonly string? _userHash;
    private bool _conversationDeleted;
    private bool _userDeleted;

    internal TurnState(
        string? conversationKey,
        string? userKey,
        Dictionary<string, object?> conversationData,
        Dictionary<string, object?> userData,
        Dictionary<string, object?> tempData)
    {
        _conversationKey = conversationKey;
        _userKey = userKey;
        _conversation = new StateScope(conversationData);
        _user = new StateScope(userData);
        _temp = new StateScope(tempData);

        // Compute initial hashes for dirty tracking
        _conversationHash = ComputeHash(conversationData);
        _userHash = ComputeHash(userData);
    }

    /// <summary>
    /// Conversation-scoped state (persisted per conversation).
    /// </summary>
    public StateScope Conversation => _conversation;

    /// <summary>
    /// User-scoped state (persisted per user across conversations).
    /// </summary>
    public StateScope User => _user;

    /// <summary>
    /// Temporary state for the current turn (not persisted).
    /// </summary>
    public StateScope Temp => _temp;

    /// <summary>
    /// Get a value by path. Path format: "[scope].property" or "property" (defaults to temp).
    /// </summary>
    /// <typeparam name="T">Type to deserialize the value to.</typeparam>
    /// <param name="path">Path in the form "scope.key" or "key" (defaults to temp).</param>
    /// <returns>The value, or null/default if not found.</returns>
    public T? GetValue<T>(string path)
    {
        var (scope, key) = ParsePath(path);
        return scope.Get<T>(key);
    }

    /// <summary>
    /// Set a value by path. Path format: "[scope].property" or "property" (defaults to temp).
    /// </summary>
    /// <typeparam name="T">Type of the value.</typeparam>
    /// <param name="path">Path in the form "scope.key" or "key" (defaults to temp).</param>
    /// <param name="value">The value to store.</param>
    public void SetValue<T>(string path, T value)
    {
        var (scope, key) = ParsePath(path);
        scope.Set(key, value);
    }

    /// <summary>
    /// Check if a value exists at path.
    /// </summary>
    /// <param name="path">Path in the form "scope.key" or "key" (defaults to temp).</param>
    /// <returns>True if the value exists, false otherwise.</returns>
    public bool HasValue(string path)
    {
        var (scope, key) = ParsePath(path);
        return scope.Has(key);
    }

    /// <summary>
    /// Delete a value at path.
    /// </summary>
    /// <param name="path">Path in the form "scope.key" or "key" (defaults to temp).</param>
    public void DeleteValue(string path)
    {
        var (scope, key) = ParsePath(path);
        scope.Delete(key);
    }

    /// <summary>
    /// Delete all state in the conversation scope.
    /// </summary>
    public void DeleteConversationState()
    {
        _conversation.Clear();
        _conversationDeleted = true;
    }

    /// <summary>
    /// Delete all state in the user scope.
    /// </summary>
    public void DeleteUserState()
    {
        _user.Clear();
        _userDeleted = true;
    }

    /// <summary>
    /// Delete all state in the temp scope.
    /// </summary>
    public void DeleteTempState()
    {
        _temp.Clear();
    }

    private (StateScope scope, string key) ParsePath(string path)
    {
        var parts = path.Split('.', 2);
        if (parts.Length == 1)
        {
            // No scope prefix — default to temp
            return (_temp, path);
        }

        if (parts.Length > 2)
        {
            throw new ArgumentException($"Invalid path format: '{path}'. Expected '[scope].key' or 'key'.", nameof(path));
        }

        var scopeName = parts[0].ToLowerInvariant();
        var key = parts[1];

        return scopeName switch
        {
            "conversation" => (_conversation, key),
            "user" => (_user, key),
            "temp" => (_temp, key),
            _ => throw new ArgumentException($"Unknown scope '{parts[0]}'. Valid scopes are: conversation, user, temp.", nameof(path))
        };
    }

    internal (IDictionary<string, object>, string[]) GetChanges()
    {
        var changes = new Dictionary<string, object>();
        var deletions = new List<string>();

        // Check conversation scope
        if (_conversationKey is not null)
        {
            if (_conversationDeleted)
            {
                deletions.Add(_conversationKey);
            }
            else if (IsModified(_conversation.GetData(), _conversationHash))
            {
                changes[_conversationKey] = _conversation.GetData();
            }
        }

        // Check user scope
        if (_userKey is not null)
        {
            if (_userDeleted)
            {
                deletions.Add(_userKey);
            }
            else if (IsModified(_user.GetData(), _userHash))
            {
                changes[_userKey] = _user.GetData();
            }
        }

        // Temp scope is never persisted

        return (changes, deletions.ToArray());
    }

    private static bool IsModified(Dictionary<string, object?> data, string? originalHash)
    {
        if (originalHash is null)
        {
            return data.Count > 0;
        }
        var currentHash = ComputeHash(data);
        return currentHash != originalHash;
    }

    private static string ComputeHash(Dictionary<string, object?> data)
    {
        // Use JSON serialization as hash for dirty tracking
        var json = JsonSerializer.Serialize(data, CoreActivity.DefaultJsonOptions);
        return json;
    }
}
