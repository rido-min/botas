using System.Text.Json;

namespace Botas.State;

/// <summary>
/// A scoped key-value store within TurnState.
/// Each scope (Conversation, User, Temp) provides isolated storage.
/// </summary>
public class StateScope
{
    private readonly Dictionary<string, object?> _data;

    internal StateScope(Dictionary<string, object?> data)
    {
        _data = data;
    }

    /// <summary>
    /// Get a value by key.
    /// </summary>
    /// <typeparam name="T">Type to deserialize the value to.</typeparam>
    /// <param name="key">The key to retrieve.</param>
    /// <returns>The value, or null/default if not found.</returns>
    public T? Get<T>(string key)
    {
        if (!_data.TryGetValue(key, out var value))
        {
            return default;
        }

        if (value is null)
        {
            return default;
        }

        // Handle JsonElement deserialization (when loaded from storage)
        if (value is JsonElement jsonElement)
        {
            return jsonElement.Deserialize<T>(CoreActivity.DefaultJsonOptions);
        }

        // Direct cast if already the right type
        if (value is T typedValue)
        {
            return typedValue;
        }

        // Try to deserialize via JSON round-trip
        try
        {
            var json = JsonSerializer.Serialize(value, CoreActivity.DefaultJsonOptions);
            return JsonSerializer.Deserialize<T>(json, CoreActivity.DefaultJsonOptions);
        }
        catch
        {
            return default;
        }
    }

    /// <summary>
    /// Set a value by key.
    /// </summary>
    /// <typeparam name="T">Type of the value.</typeparam>
    /// <param name="key">The key to set.</param>
    /// <param name="value">The value to store.</param>
    public void Set<T>(string key, T value)
    {
        _data[key] = value;
    }

    /// <summary>
    /// Check if a key exists in this scope.
    /// </summary>
    /// <param name="key">The key to check.</param>
    /// <returns>True if the key exists, false otherwise.</returns>
    public bool Has(string key)
    {
        return _data.ContainsKey(key);
    }

    /// <summary>
    /// Delete a key from this scope.
    /// </summary>
    /// <param name="key">The key to delete.</param>
    public void Delete(string key)
    {
        _data.Remove(key);
    }

    /// <summary>
    /// Clear all data in this scope.
    /// </summary>
    public void Clear()
    {
        _data.Clear();
    }

    internal Dictionary<string, object?> GetData() => _data;
}
