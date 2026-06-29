# PostHog Usage Telemetry

**Purpose**: Anonymous, opt-in usage telemetry to understand SDK adoption and feature usage.
**Status**: Future (design only — not yet implemented)

---

## Overview

botas emits lightweight, anonymous usage events to PostHog when an API key is configured. Telemetry is **off by default** — if `POSTHOG_API_KEY` is not set, the entire subsystem is a no-op with zero runtime cost.

**Privacy guarantees**:
- No PII (no user IDs, display names, email addresses)
- No message text or activity payloads
- No conversation IDs or channel-specific identifiers
- No IP address forwarding (SDK configured to disable IP capture)
- `distinct_id` is a deterministic hash of `CLIENT_ID` (SHA-256, hex, first 16 chars) — identifies the bot registration, not any user

---

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTHOG_API_KEY` | No | — | PostHog project API key. If unset, telemetry is completely disabled. |
| `POSTHOG_HOST` | No | `https://eu.i.posthog.com` | PostHog ingestion endpoint. Override for EU region or self-hosted. |

> **.NET note**: These are read from environment variables directly (not `IConfiguration`), since telemetry is an SDK-internal concern separate from the bot's own configuration.

### Disabling telemetry

Telemetry is **off by default**. Simply do not set `POSTHOG_API_KEY`. If the variable is set to an empty string, telemetry is also disabled.

---

## Events

All events share these common properties:

| Property | Type | Description |
|----------|------|-------------|
| `sdk_language` | string | `"dotnet"`, `"node"`, or `"python"` |
| `sdk_version` | string | Library version (from `BotApplication.Version` / `.version`) |
| `runtime_version` | string | Runtime version (e.g. `.NET 10.0`, `Node 22.x`, `Python 3.12`) |

### `botas/bot_started`

Emitted **once per process lifetime**, on the first activity processed.

| Property | Type | Description |
|----------|------|-------------|
| `handler_count` | int | Number of registered activity-type handlers |
| `invoke_handler_count` | int | Number of registered invoke handlers |
| `middleware_count` | int | Number of registered middleware |
| `has_catch_all` | bool | Whether `OnActivity`/`onActivity`/`on_activity` is set |
| `has_state_storage` | bool | Whether TurnState storage is configured |
| `auth_flow` | string | `"client_credentials"`, `"managed_identity"`, `"none"` |

### `botas/activity_received`

Emitted **once per turn** (per incoming activity processed).

| Property | Type | Description |
|----------|------|-------------|
| `activity_type` | string | The `activity.type` value (e.g. `"message"`, `"conversationUpdate"`) |
| `has_handler` | bool | Whether a matching handler was found for this type |
| `channel_type` | string | Sanitized channel hint: `"emulator"`, `"msteams"`, `"webchat"`, `"other"` |

### `botas/handler_dispatched`

Emitted **when a handler executes** (not for silently-ignored types).

| Property | Type | Description |
|----------|------|-------------|
| `activity_type` | string | Activity type that triggered the handler |
| `dispatch_mode` | string | `"type"`, `"invoke"`, or `"catchall"` |
| `duration_ms` | int | Handler execution time in milliseconds |

### `botas/handler_error`

Emitted **when a handler throws** (before wrapping in `BotHandlerException`).

| Property | Type | Description |
|----------|------|-------------|
| `activity_type` | string | Activity type being processed |
| `error_type` | string | Exception class/type name (e.g. `"TypeError"`, `"HttpRequestException"`) — never the message |

### `botas/outbound_sent`

Emitted **when an outbound API call completes** (send, update, or delete activity).

| Property | Type | Description |
|----------|------|-------------|
| `operation` | string | `"send"`, `"update"`, `"delete"`, `"create_conversation"` |
| `success` | bool | Whether the call succeeded |

---

## Distinct ID

The `distinct_id` for all events is derived from `CLIENT_ID`:

```
distinct_id = sha256(CLIENT_ID)[0:16]   // hex, first 16 chars
```

If `CLIENT_ID` is not set, use a fixed anonymous identifier: `"botas-anonymous"`. This ensures events can be grouped by bot identity without revealing the actual application ID.

---

## Pipeline Integration Point

Telemetry hooks into the existing pipeline **after** JWT validation and **inside** the `processBody` / `ProcessAsync` / `process_body` flow — the same location where existing OpenTelemetry metrics are recorded.

```
POST /api/messages
  └─ JWT validation (unchanged)
      └─ BotApplication.processBody
          ├─ [existing] OTel metrics: activitiesReceived counter
          ├─ [NEW] PostHog: botas/activity_received (fire-and-forget)
          ├─ Middleware chain (unchanged)
          └─ Handler dispatch
              ├─ [NEW] PostHog: botas/handler_dispatched (fire-and-forget)
              └─ on error: [NEW] PostHog: botas/handler_error (fire-and-forget)
```

`botas/bot_started` is emitted lazily on first turn only.
`botas/outbound_sent` fires inside `ConversationClient` after each API call.

**Critical**: All PostHog calls are **fire-and-forget** (async, non-blocking). A failure to send telemetry must never affect bot processing, throw exceptions, or add latency to the turn pipeline.

---

## SDK Dependencies

| Language | Package | Fallback |
|----------|---------|----------|
| .NET | `PostHog` (NuGet) | No-op (package not referenced = disabled) |
| Node.js | `posthog-node` (npm) | No-op (optional peer dependency) |
| Python | `posthog` (PyPI) | No-op (`ImportError` → disabled) |

Each language uses the **optional/lazy-load pattern** already established for OpenTelemetry:
- Node.js: dynamic `import('posthog-node')` with catch (same pattern as `@opentelemetry/api`)
- Python: `try: import posthog` / `except ImportError: pass` (same as `opentelemetry`)
- .NET: conditional compilation or runtime check for assembly presence

### PostHog Client Configuration

```
client = PostHog(
    api_key = POSTHOG_API_KEY,
    host = POSTHOG_HOST,
    disable_geoip = true,       // no IP-based location
    flush_interval = 30s,       // batch events, don't block
    flush_at = 20,              // or every 20 events
)
```

---

## Implementation Structure (per language)

### Module / File

| Language | File | Visibility |
|----------|------|------------|
| .NET | `Botas/PostHogTelemetry.cs` | `internal static` |
| Node.js | `botas-core/src/posthog-telemetry.ts` | not exported from `index.ts` |
| Python | `botas/_posthog_telemetry.py` | private module (underscore prefix) |

### Public API Surface

**None.** This is entirely internal. No public types, methods, or configuration options beyond the two environment variables. Users opt in simply by setting `POSTHOG_API_KEY`.

### Initialization

Lazy-initialize on first call. The module exposes an internal function:

```
// Pseudocode (all languages)
function trackEvent(name: string, properties: Record<string, any>): void
```

On first call:
1. Read `POSTHOG_API_KEY` from env. If empty/unset → set global no-op flag, return.
2. Try to import/load PostHog SDK. If unavailable → set no-op flag, return.
3. Create PostHog client with config above.
4. Send event (fire-and-forget).

Subsequent calls check the no-op flag first (single boolean check = zero cost when disabled).

---

## Behavioral Invariants (cross-language)

1. **Off by default**: No env var = no-op. Zero runtime cost.
2. **Never block the pipeline**: All telemetry calls are fire-and-forget.
3. **Never throw**: Any PostHog error is silently swallowed (log at DEBUG/trace level only).
4. **No PII**: Events contain only type names, counts, durations, and boolean flags.
5. **Identical event schema**: All three languages emit the same event names with the same property keys.
6. **Same distinct_id derivation**: SHA-256 of CLIENT_ID, first 16 hex chars.
7. **Graceful degradation**: Missing SDK package = disabled (not a startup error).
8. **Flush on shutdown**: Best-effort flush of buffered events on process exit (language-appropriate: `AppDomain.ProcessExit` / `process.on('exit')` / `atexit`).

---

## What This Spec Does NOT Cover

- docs-site analytics (handled separately with client-side PostHog JS)
- A/B testing or feature flags
- Any user-facing telemetry opt-out UI
- Exporting PostHog data to OpenTelemetry or vice versa

---

## References

- [PostHog Node.js SDK](https://posthog.com/docs/libraries/node)
- [PostHog Python SDK](https://posthog.com/docs/libraries/python)
- [PostHog .NET SDK](https://posthog.com/docs/libraries/dotnet)
- [Observability spec](../observability.md) — existing OpenTelemetry instrumentation (complementary, not overlapping)
- [Configuration spec](../configuration.md) — existing env var conventions
