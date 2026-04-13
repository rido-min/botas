# Python RemoveMentionMiddleware Parity Fix

**Author:** Fry (Node Dev, cross-assigned) | **Status:** Completed | **Review:** leela-middleware-parity-review.md

## What changed

Fixed Python `RemoveMentionMiddleware` to match .NET reference implementation per Leela's parity review.

### 1. Removed `recipient.name` matching
Python was doing a three-way OR (`appid || recipient.id || recipient.name`). Now uses two-stage fallback: `appid ?? recipient.id`, matching .NET exactly.

### 2. Case-insensitive ID comparison
Changed `==` to `.casefold()` comparison so bot IDs with different casing still match (e.g. `BOT1` matches `bot1`).

### 3. Case-insensitive text replacement
Added `re.IGNORECASE` flag to `re.sub` so `<AT>BotName</AT>` gets stripped even if casing differs from `entity.text`.

## Test results
- 48 Python tests pass (3 new: case-insensitive ID, case-insensitive text, no name-matching)
- ruff lint: all checks passed

## Remaining review items (not in scope)
- **Node.js:** Still needs AppId lookup + case-insensitive + replaceAll (assigned to Hermes per review)
- **Docs:** Still needs update (assigned to Amy per review)
