# Spec Drift Detection: Visibility Claims

## Pattern
When a code change makes a previously internal/private type public (or vice versa), stale visibility claims in specs and docs can persist. This creates spec-code drift that confuses users.

## Trigger
- PR titles like "expose public X" / "make Y public" / "remove private from Z"
- Change log entries mentioning visibility changes (internal → public, private → public)
- Review comments indicating API surface changes

## What to Search For
After merging a visibility change, grep `specs/` and `docs-site/` for stale claims:

```bash
# Replace TYPE with the class/type name
grep -r "internal TYPE\|does NOT expose\|not expose.*TYPE\|\.NET.*private.*TYPE" specs/ docs-site/
```

Common stale phrases:
- "does NOT expose its X publicly"
- "internal field on [Class]"
- "X is a private field"
- "not exposed in .NET"
- ".NET keeps X internal"

## How to Fix
1. **Remove outdated negations** — Delete or invert sentences that claim the type is not public
2. **Add language parity examples** — If the type is now public, show code examples for all languages
3. **Update feature tables** — Refactor tables showing "Node/Python only" to reflect cross-language support
4. **Verify Language-Specific Intentional Differences** — Check `specs/README.md` for stale entries mentioning the type

## Example
**PR #349** made `ConversationClient` public in .NET. Spec still said: "`.NET does NOT expose its ConversationClient` publicly (it is a private field on BotApplication)."

**Fix**: Removed the negative claim, added .NET code examples, updated API table to show .NET supports `SendActivityAsync` and `CreateConversationAsync` with checkmarks.

## When to Apply
- During PR review of any visibility changes
- When reconciling A2-type spec drift issues
- As part of docs-first feature delivery (D1 directive) — public API changes always require spec/docs updates

## Files to Audit
- `specs/proactive-messaging.md` — frequently mentions visibility differences
- `specs/README.md` — Language-Specific Intentional Differences table
- `docs-site/` — language-specific guides may repeat spec claims

## Notes
This pattern prevents the "user finds example in spec that doesn't work because API is actually public" problem. Always search after visibility changes.
