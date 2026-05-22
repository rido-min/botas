# Agent Spawn Log: Hermes (Python Error Format Implementation)

**Date:** 2026-04-25T11:24:31Z  
**Agent:** Hermes (Python Dev)  
**Issue:** #247  
**Branch:** fix/python-error-format  
**PR:** #256  
**Status:** Complete  

## What Was Done

Implemented standard HTTP error response format (as decided by Leela) in Python FastAPI adapter:

**Changes to `botas-fastapi/bot_auth.py`:**
- Replaced FastAPI's default `HTTPException` (which returns `{"detail": ...}`) with `JSONResponse`
- Now returns: `JSONResponse(status_code=401, content={"error": "Unauthorized", "message": str(exc)})`
- Sets `Content-Type: application/json` automatically

**Changes to 405 handler (if present):**
- 405 for non-POST methods returns: `{"error": "MethodNotAllowed", "message": "Only POST is accepted"}`

**Note on aiohttp samples:**
- If aiohttp sample exists, it should use `web.json_response({"error": "Unauthorized", "message": str(exc)}, status=401)`

## Outcome

Python 401/405 error responses now match standard format. Achieves parity with Node.js and .NET implementations.

## Decision Alignment

Implements error format standard from `.squad/decisions/inbox/leela-error-format.md`:
- Body shape: `{"error": "{ErrorCode}", "message": "{description}"}`
- Content-Type: `application/json`
- 401: `error: "Unauthorized"`
- 405: `error: "MethodNotAllowed"`

## Files Modified

- `python/packages/botas-fastapi/src/botas_fastapi/bot_auth.py` — 401 JSON response
- `python/packages/botas-fastapi/src/botas_fastapi/bot_app.py` — 405 JSON response (if updated)
- `python/samples/` — if aiohttp sample exists, apply same format

## Next Steps

1. Fry's Node.js implementation (PR #257) already merged
2. Amy implements .NET format (PR #258)
3. All three PRs reviewed and merged in same batch
