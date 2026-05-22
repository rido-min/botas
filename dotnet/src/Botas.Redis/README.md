# Botas.Redis

Redis-backed `IStorage` provider for Botas state.

## Install

```bash
dotnet add package Botas.Redis
```

## Quick start

```csharp
using Botas.Redis;

await using var storage = new RedisStorage("redis://localhost:6379");
app.UseState(storage);
```

Use a custom prefix when sharing a Redis instance:

```csharp
await using var storage = new RedisStorage("redis://localhost:6379", keyPrefix: "mybot:");
```

For more patterns, see the [State Management Guide](../../../docs-site/state.md).
