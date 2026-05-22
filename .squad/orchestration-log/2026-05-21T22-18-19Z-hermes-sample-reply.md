# Orchestration: Hermes Sample Reply Fix

**Agent:** Hermes (claude-sonnet-4.5, background)  
**Timestamp:** 2026-05-21T22:18:19Z  
**Issue:** Python `06-state-bot` sample never replied to users

## Root Cause
Handler built reply in temp state but forgot to call `ctx.send()` — copy-paste error during sample creation.

## Fix Applied
- Added `await ctx.send(reply)` in all 3 code paths (regular message, "reset", "whoami")
- Added offline mode: when `CLIENT_ID` unset, replies logged to console as `[OFFLINE] Would send: ...`
- Offline mode UX lets users kick the tires without provisioning Azure bot

## Files Modified
- `python/samples/06-state-bot/main.py` — offline check + send calls
- `python/samples/06-state-bot/README.md` — documented offline behavior
- `.squad/agents/hermes/history.md` — updated with fix context
- `.squad/decisions/inbox/hermes-sample-offline-mode.md` — follow-up cross-language note (new)

## Library Impact
**NONE** — sample-only fix. No library behavior changes.

## Parity Ripple
.NET and Node samples already send replies correctly. Hermes created cross-language check note in inbox for Amy/Fry to mirror offline mode UX if useful (not blocking).

## Test Result
- 216 Python tests pass ✅
- ruff clean ✅
- Smoke verified: state files created, offline replies logged ✅

## Requested By
Rido
