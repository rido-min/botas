# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Core Context

**Project foundations (2026-04-13 initial work):**
- **Spec-implementation sync**: Fixed `specs/reference/dotnet.md` API surface (ProcessAsync signature, TurnContext return types, OnInvoke handler, AppId/Version properties). Only `SendActivityAsync` implemented in ConversationClient (update/delete/members Node.js/Python only).
- **.NET security audit clean**: JWT validation robust (all flags enabled, OIDC resolution correct). TypeScript-style `BotHandlerException` typo found (breaking change). HttpClient socket exhaustion risk in no-auth mode (use IHttpClientFactory). Activity deserialization missing required field validation. PII risk in trace-level logging. Overall production-ready with minor improvements.
- **Typing activity pattern**: `SendTypingAsync()` returns `Task<string>` (activity ID) for internal .NET consistency. `OnTyping()` is syntactic sugar over `On("typing", handler)`. Intentional cross-language difference vs. Node.js/Python void return.
- **RemoveMentionMiddleware design**: `ITurnMiddleWare` (capital W), `NextDelegate` callback, `CoreActivity.Entities` is JsonArray with mention type/mentioned/text fields. `BotApp` defers both handler and middleware registration until `Run()`.
- **Reliability fixes (Issues #103-106)**: DI memory leak fixed via `Configure<T>()` deferred resolution. ConfigurationManager caching eliminates per-request OIDC fetches. Error messages sanitized (raw response bodies removed). HttpClient timeout set to 30s.

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- **Files changed:** `BotApplicationConfigurationExtensions.cs` (DI fixes + timeout), `JwtExtensions.cs` (DI fixes + caching), `ConversationClient.cs` (error sanitization). **New files:** `AgentScopeProvider.cs`, `BotAuthenticationOptions.cs`, `BotAuthenticationMultiOptions.cs`, `ConfigurationManagerCache.cs`.
- **PR:** #135 merged into main. All four issues resolved in a single PR for atomic fix.
### .NET Audit Medium/Low Findings (2026-04-13)
- **Fixed remaining audit findings from #75** (PR #137): Input validation for required Activity fields (Type, Conversation.Id, ServiceUrl); removed misleading async from JWT event handlers; improved catch block to re-throw OperationCanceledException and BotHandlerException; added Kestrel MaxRequestBodySize (1 MB); reduced PII in trace logs (log type only, not full JSON); documented Use() as startup-only.
- **Skipped items:** HttpClient lifecycle (#101) already fixed in open PR #133; ValueTask over-optimization is informational only.
- **All 48 tests pass.**

### FluentCards Refactor — TeamsSample (2026-04-13)
- **Refactored `dotnet/samples/TeamsSample/Program.cs`** to replace raw JSON Adaptive Card strings with the `FluentCards` NuGet package (v0.2.0-beta-0001, prerelease).
- **Welcome card** ("cards" handler): uses `AdaptiveCardBuilder` with TextBlock, Input.Text, and Action.Execute (verb="submitAction").
- **Invoke response card**: extracts verb and data from `ctx.Activity.Value`, echoes them back as TextBlocks, adds Action.Execute with verb="refresh" for round-trip testing.
- **Unchanged handlers:** SuggestedActions and mention echo remain untouched.
- **Pattern:** `card.ToJson()` feeds into `TeamsActivityBuilder.WithAdaptiveCardAttachment()`.
- **Build:** 0 compilation errors; 73 tests pass. Pre-existing NU1901 vulnerability warnings on `System.Security.Cryptography.Xml` are unrelated.
- **Key files:** `dotnet/samples/TeamsSample/Program.cs`, `dotnet/samples/TeamsSample/TeamsSample.csproj`.

### FluentCards Adoption Cross-Language Session (2026-04-15)
- **Cross-language decision approved and implemented.** All three language teams (Amy .NET, Fry Node, Hermes Python) adopted fluent-cards/FluentCards builder libraries for Adaptive Card construction in teams-samples.
- **Amy:** Refactored .NET TeamsSample with FluentCards NuGet (v0.2.0-beta-0001). 73 tests pass.
- **Fry:** Refactored Node teams-sample with fluent-cards npm (v0.2.0-beta.1). 7 tests pass.
- **Hermes:** Refactored Python teams-sample with fluent-cards PyPI. 94 tests pass, ruff clean.
- **Pattern parity:** All three implementations now use fluent builders; welcome → invoke echo pattern consistent across languages.
- **Decision logged:** `.squad/decisions.md` entry #15 (FluentCards Adoption).

### API Documentation — XML Doc Comments (2026-04-22)
- **Added XML doc comments to all 14 public API files** in `dotnet/src/Botas/` per user directive (Rido, 2026-04-22T21:27).
- **Files documented:**
  - Core API: `BotApplication.cs`, `BotApp.cs`, `TurnContext.cs`
  - Models: `CoreActivity.cs`, `CoreActivityBuilder.cs`, `ChannelAccount.cs`, `Conversation.cs`, `Entity.cs`, `Attachment.cs`
  - Utilities: `ConversationClient.cs`, `RemoveMentionMiddleware.cs`, `ITurnMiddleware.cs`, `BotHandlerException.cs`, `TokenManager.cs`
- **Style:** Standard XML documentation format with `<summary>`, `<param>`, `<returns>`, `<remarks>` tags
- **Impact:** API now fully documented for Visual Studio IntelliSense; DocFX can generate reference docs from compiled assembly
- **Cross-language coordination:** Node.js (JSDoc) and Python (docstrings) also documented in parallel session
- **Test status:** All 77 tests pass
- **PR:** #225 (consolidated with Fry/Hermes docs) — Fixes #224


### DefaultDocumentation for Automated API Docs (2026-04-22)
- **Configured DefaultDocumentation** for automated .NET API doc generation with cross-linked types.
- **Tool choice:** Selected DefaultDocumentation over DocFX markdown templates due to native markdown output, automatic cross-linking, and VitePress compatibility.
- **Changes made:**
  - Enabled XML doc generation in Botas.csproj: <GenerateDocumentationFile>true</GenerateDocumentationFile>
  - Updated generate-api-docs.sh to use DefaultDocumentation CLI: defaultdocumentation --AssemblyFilePath <dll> --OutputDirectoryPath ../docs-site/api/generated/dotnet --GeneratedPages "Namespaces, Types, Members"
  - Added sidebar entry in .vitepress/config.mts under "API Reference (Generated)"
  - Created index.md navigation page at docs-site/api/generated/dotnet/
- **Output:** One markdown file per type with cross-links to related types and external .NET BCL links
- **Example cross-links:** [BotApplication](Botas.BotApplication.md), [System.Object](https://learn.microsoft.com/en-us/dotnet/api/system.object)
- **Tool version:** DefaultDocumentation.Console 1.2.4
- **Test status:** All 77 tests pass
- **Decision:** See .squad/decisions/inbox/amy-docfx-setup.md for evaluation details
- **Key insight:** DefaultDocumentation generates cleaner VitePress-compatible markdown than DocFX v2/v3 templates without post-processing

### Standard Error Response Format (2026-04-25)
- **Implemented JSON error responses** for .NET (#247, PR #258)
- 401 responses now return `{"error":"Unauthorized","message":"Missing or invalid Authorization header"}` instead of empty body
- 405 responses for non-POST methods return `{"error":"MethodNotAllowed","message":"Only POST is accepted"}`
- Used middleware approach (not OnChallenge) because ASP.NET multi-scheme auth challenges fire per-scheme, causing conflicts
- Added `ErrorResponseFormatTests` integration tests using `Microsoft.AspNetCore.TestHost`
- Key learning: `OnChallenge` in JwtBearerEvents doesn't work cleanly with multi-scheme policies — middleware before auth is more reliable

### Promote Id and ChannelId to Typed Fields (#261) (2026-07-15)
- **Task:** Added `Id` and `ChannelId` as typed string properties on `CoreActivity`, following the same `[JsonPropertyName]` pattern as existing fields (Type, Text, ServiceUrl, etc.).
- **Changes:** `dotnet/src/Botas/CoreActivity.cs` — two new nullable string properties; `dotnet/tests/Botas.Tests/CoreActivityTests.cs` — three new tests (deserialization, serialization, round-trip).
- **Key insight:** System.Text.Json's `[JsonExtensionData]` automatically excludes typed properties from the extension dictionary — no extra exclusion logic needed.
- **Result:** All 85 tests pass. Fields deserialize from JSON, stay out of `Properties`, and round-trip correctly.

### Fix Invoke Dispatch: 200 when no handlers, 501 when no match (#262) (2026-04-25)
- **Task:** Changed invoke dispatch so bots with zero invoke handlers return HTTP 200 (not 501) for invoke activities, while bots with handlers that don't match the invoke name still return 501.
- **Changes:** dotnet/src/Botas/BotApplication.cs — added early return `if (_invokeHandlers.Count == 0) return 200` before name lookup; dotnet/tests/Botas.Tests/InvokeActivityTests.cs — replaced 2 old tests with 4 new tests covering both no-handler and no-match scenarios.
- **Key insight:** The distinction matters because a bot that simply doesn't handle invokes should succeed silently (200), but a bot that *tries* to handle invokes and fails to match is a real "not implemented" (501).
- **Result:** All 84 tests pass. Build clean, zero warnings.
- Key learning: `OnChallenge` in JwtBearerEvents doesn't work cleanly with multi-scheme policies — middleware before auth is more reliable

### Case-Insensitive Handler Lookup (#263) (2025-07-17)
- **Finding:** The handler dictionary already used `StringComparer.OrdinalIgnoreCase` — case-insensitive lookup was already implemented, just untested
- **Changes:** Promoted `DispatchToHandler` from `private` to `internal` for testability (leveraging existing `InternalsVisibleTo`)
- **Added 3 tests** in `CaseInsensitiveHandlerTests.cs`: uppercase→lowercase match, lowercase→mixed-case match, same-key replacement across casings
- **Key learning:** Always check existing code before assuming a bug — sometimes the fix is just adding test coverage to lock down correct behavior
l
### OTel Foundation — BotActivitySource (2025-07-17)
- **Task:** PR 1 of 6 for observability spec. Created `BotActivitySource.cs` — a static class providing a shared `System.Diagnostics.ActivitySource` named `"botas"`.
- **Key design:** `ActivitySource` is built into .NET — no NuGet packages needed. Uses `internal static readonly` with lazy initialization via the static field initializer. Version comes from assembly metadata.
- **Tests:** 4 tests in `BotActivitySourceTests.cs` — source not null, name is "botas", StartActivity returns null without listener (no-op), StartActivity returns Activity with `ActivityListener` configured.
- **Result:** All 101 tests pass. Build clean. No modifications to existing files.
- **Key learning:** `System.Diagnostics.ActivitySource` is the .NET-native OTel API — no extra packages required. `StartActivity()` returns null when no listener is subscribed, providing zero-overhead no-op behavior.

### Auth & ConversationClient Spans — PR 3+4 (2025-07-17)
- **Task:** Combined PR 3 (auth spans) and PR 4 (ConversationClient span) from the observability spec.
- **`botas.auth.outbound` span** added in `BotAuthenticationHandler.SendAsync()` wrapping token acquisition and base send. Tags: `auth.scope`, `auth.flow` ("client_credentials"), `auth.cache_hit` (defaults to `false` — Microsoft.Identity.Web doesn't expose cache-hit info). Error status set on exceptions.
- **`botas.conversation_client` span** added in `ConversationClient.SendActivityAsync()` after `ValidateServiceUrl` (SSRF check stays outside the span). Tags: `conversation.id`, `activity.type`, `service.url`. Error status set on failures using `when` filter pattern to avoid swallowing exceptions.
- **Inbound auth (`botas.auth.inbound`):** Not added — ASP.NET Core's built-in auth middleware already emits spans when OTel is configured. Adding a wrapper would duplicate framework telemetry. Documented as .NET intentional difference.
- **Tests:** 6 new tests in `AuthAndConversationClientSpanTests.cs` — span created with correct attributes (auth outbound + CC), no spans without listener, error status on failure for both.
- **Result:** All 115 tests pass. Build clean.
- **Key insight:** The `when` filter pattern (`catch (Exception ex) when (ccActivity is not null)`) is elegant for OTel error recording — it only enters the catch block when the span exists but always rethrows, avoiding adding overhead when no listener is configured.

### PR 5: OTel Setup in .NET EchoBot Sample (2026-07-18)
- **Task:** Add OpenTelemetry setup to `dotnet/samples/EchoBot/Program.cs` per `specs/observability.md`.
- **Problem:** `BotApp` encapsulates `WebApplicationBuilder` internally — no way to call `builder.Services.AddOpenTelemetry()` from outside. Added `IServiceCollection Services` property to `BotApp` to expose the service collection.
- **Packages added:** `OpenTelemetry.Extensions.Hosting`, `OpenTelemetry.Exporter.OpenTelemetryProtocol`, `OpenTelemetry.Exporter.Console` (all 1.12.0) — dev-friendly setup, not Azure Monitor (production concern).
- **Key pattern:** `app.Services.AddOpenTelemetry().WithTracing(t => t.AddSource("botas").AddOtlpExporter().AddConsoleExporter())` — the `AddSource("botas")` captures botas library spans.
- **Result:** Build succeeded (0 errors, 2 NU1902 warnings for OTel.Api vulnerability advisory). All 115 tests pass.

### OtelBot Sample & EchoBot Cleanup (2026-04-14)
- **Task:** Split EchoBot into minimal echo + dedicated OTel sample per Rido's request.
- **EchoBot stripped:** Removed all OpenTelemetry packages and code. Now a pure 10-line minimal bot sample — ideal for getting-started docs.
- **OtelBot created:** New `dotnet/samples/OtelBot/` with Program.cs, OtelBot.csproj, and README.md. Demonstrates `AddSource("botas")`, OTLP + console exporters, with comments for Aspire Dashboard and Azure Monitor.
- **Solution updated:** Added OtelBot.csproj to `dotnet/Botas.slnx`.
- **Key insight:** Samples should be single-concern. EchoBot = minimal hello-world; OtelBot = observability showcase.

### ActivitySource Test Isolation Fix (2026-07-17)
- **Problem:** `StartActivity_ReturnsNull_WhenNoListenerConfigured` failed in CI because xUnit runs test classes in parallel. Other classes (`CoreSpanTests`, `AuthAndConversationClientSpanTests`) register global `ActivityListener`s that leak across parallel test classes.
- **Fix:** Added `[Collection("ActivitySource")]` attribute to all three test classes that interact with the static `ActivitySource`. This serializes their execution, preventing listener interference.
- **Key insight:** `System.Diagnostics.ActivitySource` and `ActivityListener` are global/static. Any test asserting "no listener" behavior must be serialized against tests that register listeners. xUnit's `[Collection]` is the correct mechanism.
- **All 115 tests pass.**
- **2026-05-06: A2 spec reconciliation — ConversationClient visibility recorded.** Noted that PR #349 established .NET ConversationClient as public API. Spec drift reconciled in PR #360 via Kif's update to `specs/proactive-messaging.md` reflecting public visibility. Drift-detection pattern added for future claim validation.
