using System.Text;
using System.Text.Json;

namespace Botas.State;

/// <summary>
/// File-based storage implementation that persists state as JSON files on disk.
/// One file per key. Not thread-safe — designed for single-instance deployments only.
/// Concurrent access from multiple processes or instances will cause data corruption.
/// </summary>
public class FileStorage : IStorage
{
    private readonly string _rootDirectory;

    /// <summary>
    /// Initializes a new instance of FileStorage with the default root directory "./bot-state".
    /// </summary>
    public FileStorage() : this("./bot-state")
    {
    }

    /// <summary>
    /// Initializes a new instance of FileStorage with a custom root directory.
    /// </summary>
    /// <param name="rootDirectory">Root directory where state files will be stored.</param>
    public FileStorage(string rootDirectory)
    {
        _rootDirectory = rootDirectory;
    }

    /// <summary>
    /// Read items from disk.
    /// </summary>
    /// <param name="keys">Keys to read.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Dictionary of key-value pairs that exist in storage. Missing files return empty.</returns>
    public async Task<IDictionary<string, object>> ReadAsync(string[] keys, CancellationToken cancellationToken = default)
    {
        var result = new Dictionary<string, object>();
        foreach (var key in keys)
        {
            var filePath = GetFilePath(key);
            if (File.Exists(filePath))
            {
                try
                {
                    var json = await File.ReadAllTextAsync(filePath, cancellationToken);
                    var value = JsonSerializer.Deserialize<Dictionary<string, object>>(json, CoreActivity.DefaultJsonOptions);
                    if (value is not null)
                    {
                        result[key] = value;
                    }
                }
                catch (Exception)
                {
                    // Ignore read errors — treat as missing
                }
            }
        }
        return result;
    }

    /// <summary>
    /// Write items to disk.
    /// Creates parent directories as needed.
    /// </summary>
    /// <param name="changes">Dictionary of key-value pairs to write.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    public async Task WriteAsync(IDictionary<string, object> changes, CancellationToken cancellationToken = default)
    {
        foreach (var kvp in changes)
        {
            var filePath = GetFilePath(kvp.Key);
            var directory = Path.GetDirectoryName(filePath);
            if (directory is not null && !Directory.Exists(directory))
            {
                Directory.CreateDirectory(directory);
            }

            var json = JsonSerializer.Serialize(kvp.Value, CoreActivity.DefaultJsonOptions);
            await File.WriteAllTextAsync(filePath, json, cancellationToken);
        }
    }

    /// <summary>
    /// Delete items from disk.
    /// Idempotent — no error if file does not exist.
    /// </summary>
    /// <param name="keys">Keys to delete.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    public Task DeleteAsync(string[] keys, CancellationToken cancellationToken = default)
    {
        foreach (var key in keys)
        {
            var filePath = GetFilePath(key);
            try
            {
                if (File.Exists(filePath))
                {
                    File.Delete(filePath);
                }
            }
            catch (Exception)
            {
                // Ignore delete errors — already idempotent
            }
        }
        return Task.CompletedTask;
    }

    private string GetFilePath(string key)
    {
        var sanitizedKey = SanitizeKey(key);
        return Path.Combine(_rootDirectory, $"{sanitizedKey}.json");
    }

    /// <summary>
    /// Sanitizes storage keys using percent-encoding for filesystem safety.
    /// Follows RFC 3986 via Uri.EscapeDataString, matching Node.js encodeURIComponent
    /// and Python urllib.parse.quote(key, safe="") for cross-language file portability.
    /// </summary>
    private static string SanitizeKey(string key)
    {
        // Percent-encode key for filesystem safety (RFC 3986)
        // Matches Node.js encodeURIComponent and Python urllib.parse.quote(key, safe="")
        return Uri.EscapeDataString(key);
    }
}
