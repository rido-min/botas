using System.Collections.Concurrent;
using System.Text.Json;

namespace Botas.State;

/// <summary>
/// In-memory dictionary-backed storage implementation.
/// Thread-safe and suitable for development, testing, and single-instance bot deployments.
/// State is not persisted across process restarts.
/// </summary>
public class MemoryStorage : IStorage
{
    private readonly ConcurrentDictionary<string, object> _storage = new();

    /// <summary>
    /// Read items from memory.
    /// Returns deep-cloned copies to isolate per-turn mutations.
    /// </summary>
    /// <param name="keys">Keys to read.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Dictionary of key-value pairs that exist in storage.</returns>
    public Task<IDictionary<string, object>> ReadAsync(string[] keys, CancellationToken cancellationToken = default)
    {
        var result = new Dictionary<string, object>();
        foreach (var key in keys)
        {
            if (_storage.TryGetValue(key, out var value))
            {
                // Deep clone via JSON round-trip to prevent caller from mutating the stored reference
                var cloned = DeepClone(value);
                if (cloned is not null)
                {
                    result[key] = cloned;
                }
            }
        }
        return Task.FromResult<IDictionary<string, object>>(result);
    }

    /// <summary>
    /// Write items to memory.
    /// Stores deep-cloned copies to prevent caller from mutating stored values after write.
    /// </summary>
    /// <param name="changes">Dictionary of key-value pairs to write.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    public Task WriteAsync(IDictionary<string, object> changes, CancellationToken cancellationToken = default)
    {
        foreach (var kvp in changes)
        {
            // Deep clone via JSON round-trip to prevent caller from mutating the stored reference later
            var cloned = DeepClone(kvp.Value);
            if (cloned is not null)
            {
                _storage[kvp.Key] = cloned;
            }
        }
        return Task.CompletedTask;
    }

    /// <summary>
    /// Delete items from memory.
    /// </summary>
    /// <param name="keys">Keys to delete.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    public Task DeleteAsync(string[] keys, CancellationToken cancellationToken = default)
    {
        foreach (var key in keys)
        {
            _storage.TryRemove(key, out _);
        }
        return Task.CompletedTask;
    }

    /// <summary>
    /// Deep clone an object via JSON round-trip using CoreActivity.DefaultJsonOptions.
    /// Returns null if the input is null.
    /// </summary>
    private static object? DeepClone(object? value)
    {
        if (value is null)
        {
            return null;
        }

        var json = JsonSerializer.Serialize(value, CoreActivity.DefaultJsonOptions);
        return JsonSerializer.Deserialize<object>(json, CoreActivity.DefaultJsonOptions);
    }
}
