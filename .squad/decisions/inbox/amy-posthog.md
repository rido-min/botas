# PostHog Telemetry Implementation (.NET)

**Date**: 2026-06-29  
**Agent**: Amy (dotnet-dev)  
**Branch**: `feat/dotnet-posthog`  
**Status**: Implemented, awaiting review

---

## Context

Implemented PostHog usage telemetry for the .NET library following `specs/future/telemetry.md`. Goal: anonymous, opt-in usage tracking to understand SDK adoption without collecting PII or message payloads.

---

## Implementation Approach

### 1. PostHogTelemetry.cs (internal static)

- **Location**: `dotnet/src/Botas/PostHogTelemetry.cs`
- **Visibility**: `internal static` (not exported from assembly)
- **Pattern**: Lazy-init on first call; reflection-based SDK loading (graceful fallback if missing)

**Key methods**:
- `TrackEvent(string eventName, Dictionary<string, object> properties)` — fire-and-forget via Task.Run
- `TrackBotStarted(BotApplication app)` — once-per-process flag, counts handlers/middleware via reflection
- `TrackActivityReceived(activityType, hasHandler, channelId)` — per turn after JWT validation
- `TrackHandlerDispatched(activityType, dispatchMode, durationMs)` — on handler execute
- `TrackHandlerError(activityType, errorType)` — before BotHandlerException wrap
- `TrackOutboundSent(operation, success)` — after ConversationClient API call

### 2. Reflection-Based SDK Loading

```csharp
var assembly = AppDomain.CurrentDomain.GetAssemblies()
    .FirstOrDefault(a => a.GetName().Name == "PostHog");
if (assembly == null) {
    assembly = System.Reflection.Assembly.Load("PostHog");
}
var clientType = assembly.GetType("PostHog.PostHogClient");
_posthogClient = Activator.CreateInstance(clientType, apiKey, host);
```

**Why**: No hard dependency on PostHog NuGet. If package not referenced, telemetry auto-disables.

### 3. Distinct ID Derivation

```csharp
byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(clientId));
string hex = Convert.ToHexStringLower(hash);
return hex[..16]; // First 16 hex chars
```

Matches spec exactly: `sha256(CLIENT_ID)[0:16]` (hex). If `CLIENT_ID` unset → `"botas-anonymous"`.

### 4. Integration Points

| Event | Location | When |
|-------|----------|------|
| `bot_started` | `BotApplication.ProcessAsync` | Once per process, on first activity |
| `activity_received` | `BotApplication.ProcessAsync` | Per turn, after JWT validation |
| `handler_dispatched` | `DispatchToHandler`, `DispatchInvokeHandler`, catchall callback | On handler execute (tracks duration) |
| `handler_error` | Same locations, catch blocks | Before wrapping in BotHandlerException |
| `outbound_sent` | `ConversationClient.SendActivityAsync` | After HTTP call completes (tracks success) |

### 5. Fire-and-Forget Pattern

All telemetry calls wrapped in `Task.Run(() => { try { InvokeCapture(...); } catch { } })`. Never throws, never blocks pipeline.

---

## Testing

**File**: `dotnet/tests/Botas.Tests/PostHogTelemetryTests.cs`  
**Coverage**: 9 tests (all verify no-op when `POSTHOG_API_KEY` unset or empty/whitespace)

**Result**: All 178 tests pass (1 skipped pre-existing). No regressions.

---

## Decisions

### 1. Reflection over Conditional Compilation

**Choice**: Use reflection to dynamically load PostHog SDK  
**Why**: Aligns with spec's "optional dependency" model; package not referenced = no runtime cost  
**Tradeoff**: Reflection slightly slower on first call, but one-time cost is acceptable for telemetry

### 2. State Storage Detection = False (for now)

**Choice**: `has_state_storage` always reports `false` in bot_started event  
**Why**: Correct detection requires inspecting middleware chain for StateMiddleware, which is complex and fragile  
**Future**: Revisit when StateMiddleware becomes a first-class BotApplication property

### 3. Common Properties from BotApplication.Version

**Choice**: Use `BotApplication.Version` (reads `AssemblyInformationalVersion`) for `sdk_version`  
**Why**: Single source of truth for version across all .NET instrumentation (OTel, PostHog)

### 4. Runtime Version from RuntimeInformation

**Choice**: `RuntimeInformation.FrameworkDescription` (e.g. ".NET 10.0.0") for `runtime_version`  
**Why**: Built-in, accurate, idiomatic

---

## Open Questions

1. **Should PostHog SDK be a NuGet dependency?**  
   - Current: Optional (reflection-based load)  
   - Alternative: Add as `<PackageReference>` with optional flag  
   - Decision: Keep optional for now; revisit if telemetry adoption is high

2. **Flush on shutdown?**  
   - Current: Best-effort `Shutdown()` method exists but not wired to `AppDomain.ProcessExit`  
   - Decision: Add in follow-up PR if needed (spec mentions flush but not critical for fire-and-forget)

---

## Cross-Language Coordination

Node.js and Python implementations ship in parallel:
- **Fry (Node.js)**: `node/packages/botas-core/src/posthog-telemetry.ts` with dynamic import
- **Hermes (Python)**: `python/packages/botas/src/botas/_posthog_telemetry.py` with try/import

All three emit identical event schemas with same property keys.

---

## Next Steps

1. **Review this PR** (`feat/dotnet-posthog`)
2. **Optional**: Add PostHog NuGet package to integration test CI (verify telemetry with real SDK)
3. **Merge** after Node.js + Python implementations land
4. **Document** env vars in main README (POSTHOG_API_KEY, POSTHOG_HOST)

---

## References

- `specs/future/telemetry.md` — spec contract  
- `dotnet/src/Botas/PostHogTelemetry.cs` — implementation  
- `dotnet/tests/Botas.Tests/PostHogTelemetryTests.cs` — tests  
- PostHog .NET SDK: https://posthog.com/docs/libraries/dotnet
