using System.Text.Json;
using Botas.State;
using StackExchange.Redis;

namespace Botas.Redis;

/// <summary>
/// Redis-backed storage implementation for Botas turn state.
/// Values are stored as JSON strings under keys formatted as <c>{keyPrefix}{rawKey}</c>.
/// </summary>
public class RedisStorage : IStorage, IAsyncDisposable
{
    private readonly string _keyPrefix;
    private readonly bool _ownsMultiplexer;
    private readonly IConnectionMultiplexer? _providedMultiplexer;
    private readonly Lazy<Task<IConnectionMultiplexer>> _multiplexer;

    /// <summary>
    /// Initializes a new instance of <see cref="RedisStorage" /> using a Redis connection string.
    /// The Redis connection is opened lazily on the first storage operation.
    /// </summary>
    /// <param name="connectionString">Redis connection string, for example <c>redis://localhost:6379</c>.</param>
    /// <param name="keyPrefix">Prefix applied to all Redis keys. Defaults to <c>botas:</c>.</param>
    public RedisStorage(string connectionString, string keyPrefix = "botas:")
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);

        _keyPrefix = keyPrefix ?? throw new ArgumentNullException(nameof(keyPrefix));
        _ownsMultiplexer = true;
        _multiplexer = new Lazy<Task<IConnectionMultiplexer>>(async () =>
            await ConnectionMultiplexer.ConnectAsync(ToConfigurationOptions(connectionString)).ConfigureAwait(false));
    }

    /// <summary>
    /// Initializes a new instance of <see cref="RedisStorage" /> using an existing Redis connection multiplexer.
    /// </summary>
    /// <param name="multiplexer">Existing Redis connection multiplexer.</param>
    /// <param name="keyPrefix">Prefix applied to all Redis keys. Defaults to <c>botas:</c>.</param>
    /// <param name="ownsMultiplexer">Whether this storage instance should dispose the multiplexer.</param>
    public RedisStorage(IConnectionMultiplexer multiplexer, string keyPrefix = "botas:", bool ownsMultiplexer = false)
    {
        ArgumentNullException.ThrowIfNull(multiplexer);

        _keyPrefix = keyPrefix ?? throw new ArgumentNullException(nameof(keyPrefix));
        _ownsMultiplexer = ownsMultiplexer;
        _providedMultiplexer = multiplexer;
        _multiplexer = new Lazy<Task<IConnectionMultiplexer>>(() => Task.FromResult(multiplexer));
    }

    /// <summary>
    /// Read items from Redis.
    /// Missing keys are not included in the returned dictionary.
    /// </summary>
    /// <param name="keys">Keys to read.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Dictionary of key-value pairs that exist in storage.</returns>
    public async Task<IDictionary<string, object>> ReadAsync(string[] keys, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(keys);
        cancellationToken.ThrowIfCancellationRequested();

        var database = await GetDatabaseAsync().ConfigureAwait(false);
        var tasks = keys.Select(key => database.StringGetAsync(ToRedisKey(key))).ToArray();
        var values = await Task.WhenAll(tasks).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();

        var result = new Dictionary<string, object>();
        for (var i = 0; i < keys.Length; i++)
        {
            var value = values[i];
            if (value.IsNull)
            {
                continue;
            }

            var deserialized = JsonSerializer.Deserialize<Dictionary<string, object>>(
                value.ToString(),
                CoreActivity.DefaultJsonOptions);
            if (deserialized is not null)
            {
                result[keys[i]] = deserialized;
            }
        }

        return result;
    }

    /// <summary>
    /// Write items to Redis as JSON strings.
    /// </summary>
    /// <param name="changes">Dictionary of key-value pairs to write.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    public async Task WriteAsync(IDictionary<string, object> changes, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(changes);
        cancellationToken.ThrowIfCancellationRequested();

        var database = await GetDatabaseAsync().ConfigureAwait(false);
        var tasks = changes.Select(kvp =>
        {
            var json = JsonSerializer.Serialize(kvp.Value, CoreActivity.DefaultJsonOptions);
            return database.StringSetAsync(ToRedisKey(kvp.Key), json);
        }).ToArray();

        await Task.WhenAll(tasks).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();
    }

    /// <summary>
    /// Delete items from Redis.
    /// The operation is idempotent; missing keys are ignored.
    /// </summary>
    /// <param name="keys">Keys to delete.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    public async Task DeleteAsync(string[] keys, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(keys);
        cancellationToken.ThrowIfCancellationRequested();

        var database = await GetDatabaseAsync().ConfigureAwait(false);
        var tasks = keys.Select(key => database.KeyDeleteAsync(ToRedisKey(key))).ToArray();
        await Task.WhenAll(tasks).ConfigureAwait(false);
        cancellationToken.ThrowIfCancellationRequested();
    }

    /// <summary>
    /// Disposes the Redis connection multiplexer when this instance owns it.
    /// </summary>
    public async ValueTask DisposeAsync()
    {
        if (!_ownsMultiplexer)
        {
            return;
        }

        if (_providedMultiplexer is null && !_multiplexer.IsValueCreated)
        {
            return;
        }

        var multiplexer = _providedMultiplexer ?? await _multiplexer.Value.ConfigureAwait(false);
        if (multiplexer is IAsyncDisposable asyncDisposable)
        {
            await asyncDisposable.DisposeAsync().ConfigureAwait(false);
        }
        else
        {
            multiplexer.Dispose();
        }
    }

    private async Task<IDatabase> GetDatabaseAsync()
    {
        var multiplexer = await _multiplexer.Value.ConfigureAwait(false);
        return multiplexer.GetDatabase();
    }

    private RedisKey ToRedisKey(string key) => _keyPrefix + key;

    private static ConfigurationOptions ToConfigurationOptions(string connectionString)
    {
        if (!Uri.TryCreate(connectionString, UriKind.Absolute, out var uri)
            || (uri.Scheme != "redis" && uri.Scheme != "rediss"))
        {
            return ConfigurationOptions.Parse(connectionString);
        }

        var options = new ConfigurationOptions
        {
            Ssl = uri.Scheme == "rediss"
        };

        var port = uri.IsDefaultPort ? 6379 : uri.Port;
        options.EndPoints.Add(uri.Host, port);

        if (!string.IsNullOrEmpty(uri.UserInfo))
        {
            var userInfo = uri.UserInfo.Split(':', 2);
            if (userInfo.Length == 2)
            {
                options.User = Uri.UnescapeDataString(userInfo[0]);
                options.Password = Uri.UnescapeDataString(userInfo[1]);
            }
            else
            {
                options.Password = Uri.UnescapeDataString(userInfo[0]);
            }
        }

        var path = uri.AbsolutePath.Trim('/');
        if (!string.IsNullOrEmpty(path) && int.TryParse(path, out var database))
        {
            options.DefaultDatabase = database;
        }

        return options;
    }
}
