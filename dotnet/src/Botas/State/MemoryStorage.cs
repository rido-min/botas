using System.Collections.Concurrent;

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
                result[key] = value;
            }
        }
        return Task.FromResult<IDictionary<string, object>>(result);
    }

    /// <summary>
    /// Write items to memory.
    /// </summary>
    /// <param name="changes">Dictionary of key-value pairs to write.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    public Task WriteAsync(IDictionary<string, object> changes, CancellationToken cancellationToken = default)
    {
        foreach (var kvp in changes)
        {
            _storage[kvp.Key] = kvp.Value;
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
}
