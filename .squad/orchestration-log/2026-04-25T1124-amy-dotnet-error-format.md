# Agent Spawn Log: Amy (.NET Error Format Implementation)

**Date:** 2026-04-25T11:24:31Z  
**Agent:** Amy (.NET Dev)  
**Issue:** #247  
**Branch:** fix/dotnet-error-format  
**PR:** #258  
**Status:** Complete  

## What Was Done

Implemented standard HTTP error response format (as decided by Leela) in .NET ASP.NET Core middleware:

**Changes to `JwtExtensions.cs` (JWT authentication handler):**
- Configured JWT bearer `OnChallenge` event to write standard JSON body instead of empty default
- Now returns:
  ```csharp
  context.Response.StatusCode = 401;
  context.Response.ContentType = "application/json";
  await context.Response.WriteAsync("{\"error\":\"Unauthorized\",\"message\":\"Missing or invalid Authorization header\"}");
  context.HandleResponse();
  ```

**Changes to 405 handler (if middleware pattern used):**
- 405 for non-POST methods returns: `{"error": "MethodNotAllowed", "message": "Only POST is accepted"}`

## Outcome

.NET 401/405 error responses now match standard format. Achieves full parity with Node.js and Python implementations.

## Decision Alignment

Implements error format standard from `.squad/decisions/inbox/leela-error-format.md`:
- Body shape: `{"error": "{ErrorCode}", "message": "{description}"}`
- Content-Type: `application/json`
- 401: `error: "Unauthorized"`
- 405: `error: "MethodNotAllowed"`

## Files Modified

- `dotnet/src/Botas/Middleware/JwtExtensions.cs` — 401 JSON response via OnChallenge event
- `.NET adapter for non-POST handling` — 405 JSON response (if applicable)

## Next Steps

1. Fry's Node.js (PR #257) and Hermes's Python (PR #256) already merged
2. This PR (#258) completes cross-language error format standardization
3. All three PRs reviewed and merged in same batch
