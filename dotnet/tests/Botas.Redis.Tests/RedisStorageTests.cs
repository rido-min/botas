using System.Collections.Concurrent;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using Botas.Redis;
using StackExchange.Redis;

namespace Botas.Redis.Tests;

public class RedisStorageTests
{
    [Fact]
    public async Task ReadAsync_OmitsMissingKeys()
    {
        var fake = new FakeConnectionMultiplexer();
        var storage = new RedisStorage(fake.Multiplexer);

        var result = await storage.ReadAsync(["missing"]);

        Assert.Empty(result);
    }

    [Fact]
    public async Task WriteAsync_ThenReadAsync_PreservesJson()
    {
        var fake = new FakeConnectionMultiplexer();
        var storage = new RedisStorage(fake.Multiplexer);
        var expected = new Dictionary<string, object>
        {
            ["count"] = 42,
            ["name"] = "test",
            ["active"] = true
        };

        await storage.WriteAsync(new Dictionary<string, object> { ["state"] = expected });
        var result = await storage.ReadAsync(["state"]);

        Assert.True(result.ContainsKey("state"));
        AssertJsonEqual(expected, result["state"]);
    }

    [Fact]
    public async Task DeleteAsync_IsIdempotent()
    {
        var fake = new FakeConnectionMultiplexer();
        var storage = new RedisStorage(fake.Multiplexer);

        await storage.DeleteAsync(["state"]);
        await storage.DeleteAsync(["state"]);

        Assert.Empty(fake.Data);
    }

    [Fact]
    public async Task WriteAsync_AppliesKeyPrefix()
    {
        var fake = new FakeConnectionMultiplexer();
        var storage = new RedisStorage(fake.Multiplexer, keyPrefix: "custom:");

        await storage.WriteAsync(new Dictionary<string, object>
        {
            ["state"] = new Dictionary<string, object> { ["count"] = 1 }
        });

        Assert.True(fake.Data.ContainsKey((RedisKey)"custom:state"));
        Assert.False(fake.Data.ContainsKey((RedisKey)"state"));
    }

    [Fact]
    public async Task KeysWithSpecialCharacters_RoundTripWithoutModification()
    {
        var fake = new FakeConnectionMultiplexer();
        var storage = new RedisStorage(fake.Multiplexer);
        var key = "channels/msteams:conv%20 with space";
        var expected = new Dictionary<string, object> { ["value"] = "ok" };

        await storage.WriteAsync(new Dictionary<string, object> { [key] = expected });
        var result = await storage.ReadAsync([key]);

        Assert.True(fake.Data.ContainsKey((RedisKey)("botas:" + key)));
        Assert.True(result.ContainsKey(key));
        AssertJsonEqual(expected, result[key]);
    }

    [Fact]
    public async Task EmptyObject_IsPreserved()
    {
        var fake = new FakeConnectionMultiplexer();
        var storage = new RedisStorage(fake.Multiplexer);

        await storage.WriteAsync(new Dictionary<string, object>
        {
            ["empty"] = new Dictionary<string, object>()
        });
        var result = await storage.ReadAsync(["empty"]);

        var state = Assert.IsType<Dictionary<string, object>>(result["empty"]);
        Assert.Empty(state);
    }

    [Fact]
    public async Task NestedObjects_ArePreserved()
    {
        var fake = new FakeConnectionMultiplexer();
        var storage = new RedisStorage(fake.Multiplexer);
        var expected = new Dictionary<string, object>
        {
            ["profile"] = new Dictionary<string, object>
            {
                ["name"] = "Ada",
                ["stats"] = new Dictionary<string, object>
                {
                    ["turns"] = 3
                }
            },
            ["tags"] = new[] { "redis", "state" }
        };

        await storage.WriteAsync(new Dictionary<string, object> { ["nested"] = expected });
        var result = await storage.ReadAsync(["nested"]);

        AssertJsonEqual(expected, result["nested"]);
    }

    [Fact]
    public async Task DisposeAsync_DisposesOwnedMultiplexer()
    {
        var fake = new FakeConnectionMultiplexer();
        var storage = new RedisStorage(fake.Multiplexer, ownsMultiplexer: true);

        await storage.ReadAsync(["missing"]);
        await storage.DisposeAsync();

        Assert.True(fake.Disposed);
    }

    [Fact]
    public async Task DisposeAsync_DisposesOwnedMultiplexerWithoutPriorUse()
    {
        var fake = new FakeConnectionMultiplexer();
        var storage = new RedisStorage(fake.Multiplexer, ownsMultiplexer: true);

        await storage.DisposeAsync();

        Assert.True(fake.Disposed);
    }

    private static void AssertJsonEqual(object expected, object actual)
    {
        var expectedNode = JsonSerializer.SerializeToNode(expected, CoreActivity.DefaultJsonOptions);
        var actualNode = JsonSerializer.SerializeToNode(actual, CoreActivity.DefaultJsonOptions);
        Assert.True(
            JsonNode.DeepEquals(expectedNode, actualNode),
            $"Expected {expectedNode?.ToJsonString()} but got {actualNode?.ToJsonString()}");
    }
}

public class RedisStorageIntegrationTests
{
    [SkipIfNoRedisFact]
    public async Task Integration_ReadAsync_OmitsMissingKeys()
    {
        await using var storage = CreateStorage();

        var result = await storage.ReadAsync(["missing"]);

        Assert.Empty(result);
    }

    [SkipIfNoRedisFact]
    public async Task Integration_WriteAsync_ThenReadAsync_PreservesJson()
    {
        await using var storage = CreateStorage();
        var expected = new Dictionary<string, object>
        {
            ["count"] = 42,
            ["name"] = "test",
            ["active"] = true
        };

        await storage.WriteAsync(new Dictionary<string, object> { ["state"] = expected });
        var result = await storage.ReadAsync(["state"]);

        Assert.True(result.ContainsKey("state"));
        AssertJsonEqual(expected, result["state"]);
    }

    [SkipIfNoRedisFact]
    public async Task Integration_DeleteAsync_IsIdempotent()
    {
        await using var storage = CreateStorage();

        await storage.DeleteAsync(["state"]);
        await storage.DeleteAsync(["state"]);

        var result = await storage.ReadAsync(["state"]);
        Assert.Empty(result);
    }

    [SkipIfNoRedisFact]
    public async Task Integration_KeyPrefix_IsApplied()
    {
        await using var storage = CreateStorage(prefix: $"botas-test-{Guid.NewGuid():N}:");
        var expected = new Dictionary<string, object> { ["value"] = "ok" };

        await storage.WriteAsync(new Dictionary<string, object> { ["state"] = expected });
        var result = await storage.ReadAsync(["state"]);

        AssertJsonEqual(expected, result["state"]);
    }

    [SkipIfNoRedisFact]
    public async Task Integration_KeysWithSpecialCharacters_RoundTripWithoutModification()
    {
        await using var storage = CreateStorage();
        var key = "channels/msteams:conv%20 with space";
        var expected = new Dictionary<string, object> { ["value"] = "ok" };

        await storage.WriteAsync(new Dictionary<string, object> { [key] = expected });
        var result = await storage.ReadAsync([key]);

        Assert.True(result.ContainsKey(key));
        AssertJsonEqual(expected, result[key]);
    }

    [SkipIfNoRedisFact]
    public async Task Integration_EmptyObject_IsPreserved()
    {
        await using var storage = CreateStorage();

        await storage.WriteAsync(new Dictionary<string, object>
        {
            ["empty"] = new Dictionary<string, object>()
        });
        var result = await storage.ReadAsync(["empty"]);

        var state = Assert.IsType<Dictionary<string, object>>(result["empty"]);
        Assert.Empty(state);
    }

    [SkipIfNoRedisFact]
    public async Task Integration_NestedObjects_ArePreserved()
    {
        await using var storage = CreateStorage();
        var expected = new Dictionary<string, object>
        {
            ["profile"] = new Dictionary<string, object>
            {
                ["name"] = "Ada",
                ["stats"] = new Dictionary<string, object>
                {
                    ["turns"] = 3
                }
            },
            ["tags"] = new[] { "redis", "state" }
        };

        await storage.WriteAsync(new Dictionary<string, object> { ["nested"] = expected });
        var result = await storage.ReadAsync(["nested"]);

        AssertJsonEqual(expected, result["nested"]);
    }

    private static RedisStorage CreateStorage(string? prefix = null)
    {
        var redisUrl = Environment.GetEnvironmentVariable("REDIS_URL")!;
        return new RedisStorage(redisUrl, prefix ?? $"botas-test-{Guid.NewGuid():N}:");
    }

    private static void AssertJsonEqual(object expected, object actual)
    {
        var expectedNode = JsonSerializer.SerializeToNode(expected, CoreActivity.DefaultJsonOptions);
        var actualNode = JsonSerializer.SerializeToNode(actual, CoreActivity.DefaultJsonOptions);
        Assert.True(
            JsonNode.DeepEquals(expectedNode, actualNode),
            $"Expected {expectedNode?.ToJsonString()} but got {actualNode?.ToJsonString()}");
    }
}

public sealed class SkipIfNoRedisFactAttribute : FactAttribute
{
    public SkipIfNoRedisFactAttribute()
    {
        if (string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("REDIS_URL")))
        {
            Skip = "Set REDIS_URL to run Redis integration tests.";
        }
    }
}

// Test-only — implements only methods used by RedisStorage.
internal sealed class FakeConnectionMultiplexer
{
    private readonly FakeDatabase _database;

    public FakeConnectionMultiplexer()
    {
        _database = new FakeDatabase();
        Multiplexer = ConnectionProxy.Create(this);
    }

    public IConnectionMultiplexer Multiplexer { get; }

    public IReadOnlyDictionary<RedisKey, RedisValue> Data => _database.Data;

    public bool Disposed { get; private set; }

    private class ConnectionProxy : DispatchProxy
    {
        public FakeConnectionMultiplexer Owner { get; set; } = null!;

        public static IConnectionMultiplexer Create(FakeConnectionMultiplexer owner)
        {
            var proxy = DispatchProxy.Create<IConnectionMultiplexer, ConnectionProxy>();
            ((ConnectionProxy)(object)proxy).Owner = owner;
            return proxy;
        }

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            return targetMethod?.Name switch
            {
                nameof(IConnectionMultiplexer.GetDatabase) => Owner._database.Database,
                nameof(IDisposable.Dispose) => DisposeOwner(),
                nameof(IAsyncDisposable.DisposeAsync) => DisposeAsyncOwner(),
                nameof(IConnectionMultiplexer.Close) => DisposeOwner(),
                nameof(IConnectionMultiplexer.CloseAsync) => CloseAsyncOwner(),
                _ => throw new NotSupportedException($"FakeConnectionMultiplexer does not implement {targetMethod?.Name}.")
            };
        }

        private object? DisposeOwner()
        {
            Owner.Disposed = true;
            return null;
        }

        private ValueTask DisposeAsyncOwner()
        {
            Owner.Disposed = true;
            return ValueTask.CompletedTask;
        }

        private Task CloseAsyncOwner()
        {
            Owner.Disposed = true;
            return Task.CompletedTask;
        }
    }
}

// Test-only — implements only methods used by RedisStorage.
internal sealed class FakeDatabase
{
    private readonly ConcurrentDictionary<RedisKey, RedisValue> _data = new();

    public FakeDatabase()
    {
        Database = DatabaseProxy.Create(this);
    }

    public IDatabase Database { get; }

    public IReadOnlyDictionary<RedisKey, RedisValue> Data => _data;

    private class DatabaseProxy : DispatchProxy
    {
        public FakeDatabase Owner { get; set; } = null!;

        public static IDatabase Create(FakeDatabase owner)
        {
            var proxy = DispatchProxy.Create<IDatabase, DatabaseProxy>();
            ((DatabaseProxy)(object)proxy).Owner = owner;
            return proxy;
        }

        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            return targetMethod?.Name switch
            {
                nameof(IDatabase.StringGetAsync) => StringGetAsync(args),
                nameof(IDatabase.StringSetAsync) => StringSetAsync(args),
                nameof(IDatabase.KeyDeleteAsync) => KeyDeleteAsync(args),
                _ => throw new NotSupportedException($"FakeDatabase does not implement {targetMethod?.Name}.")
            };
        }

        private Task<RedisValue> StringGetAsync(object?[]? args)
        {
            var key = (RedisKey)args![0]!;
            return Task.FromResult(Owner._data.TryGetValue(key, out var value) ? value : RedisValue.Null);
        }

        private Task<bool> StringSetAsync(object?[]? args)
        {
            var key = (RedisKey)args![0]!;
            var value = (RedisValue)args[1]!;
            Owner._data[key] = value;
            return Task.FromResult(true);
        }

        private Task<bool> KeyDeleteAsync(object?[]? args)
        {
            var key = (RedisKey)args![0]!;
            return Task.FromResult(Owner._data.TryRemove(key, out _));
        }
    }
}
