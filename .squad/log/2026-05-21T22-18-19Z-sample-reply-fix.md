# Sample Reply Fix — Session Log

**Date:** 2026-05-21  
**Agent:** Hermes  
**Task:** Fix Python `06-state-bot` sample — actually send replies

## Summary
Python sample handler forgot to call `ctx.send()`. Added offline mode for local testing without bot credentials. All 216 tests pass, ruff clean.

## Changes
- `python/samples/06-state-bot/main.py`: offline check + 3 send calls
- `python/samples/06-state-bot/README.md`: documented offline behavior
- Cross-language follow-up in `.squad/decisions/inbox/` for Amy/Fry

## Result
✅ Done. Ready for commit.
