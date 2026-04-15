# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->

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
