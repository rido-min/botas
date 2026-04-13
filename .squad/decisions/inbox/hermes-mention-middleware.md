# Decision: RemoveMentionMiddleware added to Python package

**Author:** Hermes (Python Dev) | **Date:** 2026-04-13 | **Issue:** #51

## What

Added `RemoveMentionMiddleware` to the Python `botas` package. It strips `<at>BotName</at>` text from incoming activities when the mention targets the current bot, so handlers receive clean user text.

## Files

- `python/packages/botas/src/botas/remove_mention_middleware.py` — middleware implementation
- `python/packages/botas/tests/test_remove_mention_middleware.py` — 8 tests
- `python/samples/echo-bot-no-mention/main.py` — sample usage
- `python/packages/botas/src/botas/__init__.py` — exported `RemoveMentionMiddleware`

## Parity note

This middleware does not yet exist in .NET or Node.js. If the team wants parity, those ports need equivalent implementations. The pattern is straightforward: iterate entities, match mention type + bot ID, regex-strip mention text.
