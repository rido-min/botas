# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

### Specs Overhaul: dotnet.md Audit and Fix (2026-04-13)
- **Task:** Fixed `specs/reference/dotnet.md` to match actual .NET implementation for Issue #259.
- **Key findings and fixes:**
  1. **ProcessAsync signature** — Doc incorrectly stated `ProcessAsync(Request, Response)`, changed to `ProcessAsync(HttpContext)` which matches actual implementation.
  2. **TurnContext return types** — All `SendAsync()` and `SendTypingAsync()` methods return `Task<string>` (activity ID), not `Task` as doc showed.
  3. **SendTypingAsync** — Confirmed exists with signature `Task<string> SendTypingAsync(CancellationToken)`.
  4. **OnInvoke handler** — Added missing documentation for `BotApplication.OnInvoke()` and `BotApp.OnInvoke()` methods; returns `InvokeResponse` object.
  5. **BotApp.Create** — Added `routePath` parameter documentation (optional, default `"api/messages"`).
  6. **Version and AppId properties** — Both exposed: `BotApplication.Version` (static), `BotApplication.AppId` (instance property).
  7. **ConversationClient** — Only `SendActivityAsync(CoreActivity)` method exists; no other methods implemented (audit was correct).
  8. **New InvokeResponse documentation** — Added full section documenting `Status` and `Body` properties with example invoke handler.
  9. **Language-Specific Differences table** — Expanded and corrected 13 entries to reflect actual API surface including AppId, Version, Route path, and Invoke handler registration.
- **Files modified:** `specs/reference/dotnet.md` only (no source code changes).
- **Testing:** Verified all changes against actual source in `dotnet/src/Botas/` — BotApp.cs, BotApplication.cs, TurnContext.cs, ConversationClient.cs.
- **Key insight:** The .NET implementation is the canonical reference; specs must match the code precisely to enable cross-language porting.

### Typing Activity Support (2026-04-13)
- **Implemented typing activity support** following approved API design from `.squad/decisions/inbox/leela-typing-api-resolved.md`.
- **New API surface:**
  - `BotApplication.OnTyping(handler)` — syntactic sugar delegating to `On("typing", handler)`
  - `BotApp.OnTyping(handler)` — wrapper in simplified API following deferred registration pattern
  - `TurnContext.SendTypingAsync(CancellationToken)` — returns `Task<string>` (activity ID) for consistency with existing `SendAsync()` overloads
- **Implementation pattern:** `SendTypingAsync()` uses `CoreActivityBuilder` with `WithType("typing")` and `WithConversationReference()` to create properly routed typing activities with no text/content fields.
- **Testing:** 8 new tests added covering handler registration, builder pattern, routing field population, and return type validation. All 50 tests pass.
- **Sample:** Created `dotnet/samples/TypingBot/` demonstrating both receiving typing indicators (via `OnTyping()`) and sending them before replies (via `SendTypingAsync()`).
- **Cross-language difference:** .NET returns `Task<string>` from `SendTypingAsync()` while Node.js/Python return void. This is an intentional language-specific decision prioritizing internal .NET consistency over signature parity.
- **Key files:** `BotApplication.cs`, `BotApp.cs`, `TurnContext.cs`, `TypingActivityTests.cs`, `samples/TypingBot/`.

### RemoveMentionMiddleware (Issue #51)
- `ITurnMiddleWare` (capital W) is the middleware interface; `NextDelegate` is the next callback type.
- `CoreActivity.Entities` is a `JsonArray` — mention entities have `type: "mention"`, `mentioned: {id, name}`, and `text` fields.
- `BotApp` defers both handler (`On`) and middleware (`Use`) registration until `Run()` since `BotApplication` isn't available until after `Build()`.
- Added `BotApp.Use(ITurnMiddleWare)` to mirror the deferred-registration pattern already used by `BotApp.On()`.
- Key files: `RemoveMentionMiddleware.cs` in `dotnet/src/Botas/`, tests in `dotnet/tests/Botas.Tests/RemoveMentionMiddlewareTests.cs`, sample in `dotnet/samples/MentionBot/`.
- `TurnContext` constructor is `internal` — tests can access it via `InternalsVisibleTo("Botas.Tests")`.

### Cross-language parity (2026-04-13)
- **Fry (Node.js):** Created `node/packages/botas/src/remove-mention-middleware.ts` implementing `ITurnMiddleware`, matches `recipient.id`, mutates `activity.text` in-place. 10 tests passing (36 total).
- **Hermes (Python):** Created `python/packages/botas/src/botas/remove_mention_middleware.py` using Protocol-based middleware, matches bot AppId, strips `<at>` mentions. 8 tests passing (45 total).
- All three implementations have behavior parity: strip bot-self mentions, case-insensitive matching, provide samples.
- **2026-04-13: OnActivity CatchAll verification (2026-04-13).** Verified existing .NET `BotApplication.OnActivity` property already implements correct CatchAll semantics per spec: when set, bypasses all per-type handlers entirely; exceptions wrapped in `BotHandlerException`; unregistered types still silently ignored. No code changes needed. .NET serves as canonical reference implementation. Noted: existing test coverage is minimal; recommend follow-up.

### Security Audit (2026-04-13)
- **Completed comprehensive audit** of all .NET code (29 files): source, samples, tests.
- **JWT validation is robust:** All critical validation flags enabled (`ValidateIssuer`, `ValidateAudience`, `ValidateIssuerSigningKey`, `RequireSignedTokens`); dynamic OIDC endpoint resolution; proper AAD signing key validation.
- **Typo found:** `BotHanlderException` (line 10 in `BotApplication.cs`) should be `BotHandlerException` — breaking change needed for parity.
- **HttpClient lifecycle issue:** `BotApp` no-auth mode creates raw `HttpClient` instead of using `IHttpClientFactory` (socket exhaustion risk in high traffic).
- **Input validation gap:** Activity deserialization doesn't validate required fields (`Type`, `Conversation.Id`, `ServiceUrl`) — could cause null reference exceptions.
- **ConfigureAwait usage:** Correctly applied throughout library code; no deadlock risks.
- **Null safety:** Excellent — nullable reference types enabled project-wide with proper annotations.
- **Dependency vulnerabilities:** None found (`dotnet list package --vulnerable` clean).
- **Logging concern:** Trace-level logging outputs full activity JSON which may contain PII.
- **Overall:** Production-ready with minor improvements needed. Security model is sound.

### Session Summary (2026-04-13)
- **Audit Result:** .NET code audit completed and logged to `dotnet/AUDIT.md` and `.squad/orchestration-log/2026-04-13T0805-amy-audit.md`.
- **Artifacts:** Orchestration log summarizes 29-file audit with 5 sections (scope, security, patterns, issues, recommendations).
- **Cross-Agent:** Node.js and Python audits completed; critical issues identified across all three implementations. See decisions.md for full context.

### Typing Activity API Review (2026-04-13)
- **Reviewed Leela's typing activity API proposal** for .NET correctness and idiom compliance.
- **Verdict:** REQUEST CHANGES — core design is sound, but two critical naming concerns:
  1. **Return type**: Proposed `Task` should be `Task<string>` to match existing `SendAsync()` overload pattern. Consistency within .NET is more important than cross-language signature matching.
  2. **Handler registration**: `OnTyping()` signature is correct, syntactic sugar implementation via `On("typing", handler)` is perfect.
- **Key insights:**
  - Our existing `TurnContext.SendAsync()` returns `Task<string>` (activity ID). New `SendTypingAsync()` should follow same pattern for consistency.
  - Bot Framework SDK v4 uses `SendTypingActivityAsync()`, but `SendTypingAsync()` is shorter and aligns with our `SendAsync()` naming.
  - No changes needed to dispatch engine or middleware — typing is just another activity type.
- **Cross-language discrepancy noted:** Node.js/Python return `void`, but .NET should prioritize internal consistency over signature parity.
- **Review documented:** `.squad/decisions/inbox/amy-typing-api-review.md` with detailed rationale, edge cases, and implementation checklist.

### P2 Audit Fixes (2026-04-13)
- **Fixed four P2 reliability and performance issues** from .NET audit findings: #103 (DI memory leak), #104 (ConfigurationManager caching), #105 (error message sanitization), #106 (HTTP timeout).
- **Issue #103 (DI memory leak):** Multiple `BuildServiceProvider()` calls during service registration created intermediate containers causing memory leaks and slow startup. Restructured to use `Configure<T>()` callbacks with deferred resolution. Created helper classes `AgentScopeProvider`, `BotAuthenticationOptions`, and `BotAuthenticationMultiOptions` to avoid premature service provider builds.
- **Issue #104 (ConfigurationManager per-request):** New `ConfigurationManager<OpenIdConnectConfiguration>` instances were created on every request, causing repeated OIDC metadata fetches. Created `ConfigurationManagerCache` using `ConcurrentDictionary` to cache instances by authority URL. Metadata now fetched once per authority and reused, dramatically improving performance under load.
- **Issue #105 (Error message exposure):** `ConversationClient` error messages included raw upstream Bot Framework API response bodies, potentially exposing internal service details. Now returns only HTTP status code to caller while logging full response server-side with `LogError` for diagnostics.
- **Issue #106 (No HTTP timeout):** `ConversationClient`'s `HttpClient` had no timeout configured, risking indefinite hangs. Set explicit 30-second timeout via `ConfigureHttpClient` in DI registration.
- **Testing:** All 48 tests pass. Build succeeds with no warnings.
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
