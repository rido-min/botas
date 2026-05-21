# Coordinator E2E Test Run

**Date:** 2026-05-05T16:06:36Z  
**Agent:** Coordinator (Squad)  
**Mode:** Direct (Playwright bypassed run-playwright-tests.ps1 due to Stop-Bot hang)  
**Request:** Rido  

## Test Execution Summary

Cross-language Playwright e2e suite run covering echo-bot, invoke-bot, and mention-bot scenarios.

### Results by Language

| Language | Passed | Failed | Duration | Branch/Notes |
|----------|--------|--------|----------|--------------|
| .NET (TestBot) | 4/4 | — | 1.3m | Echo, invoke, mention, submit all passing |
| Node.js (test-bot) | 3/4 | invoke-bot adaptive card | 1.4m | "Could not find Submit button" |
| Python (test-bot) | 3/4 | invoke-bot adaptive card | 1.4m | "Could not find Submit button" |

## Key Finding: Behavior Parity Gap

**Critical Issue:** Node.js and Python TestBot implementations do not send the adaptive card in response to user input 'card', while .NET does.

**Test Failure Pattern:**
- Test sends `card` message to bot
- .NET TestBot responds with adaptive card containing Submit button → Playwright finds button → test passes
- Node.js TestBot: no card sent → Playwright times out waiting for Submit button → test fails  
- Python TestBot: no card sent → Playwright times out waiting for Submit button → test fails

**Verdict:** This is a parity gap requiring code investigation in Node.js and Python test-bot implementations. The behavior differs, not just test infrastructure.

## Known Infrastructure Issue

**run-playwright-tests.ps1 Stop-Bot Bug:**
- PowerShell `Stop-Process` hangs when trying to terminate wrapped child processes
- Symptom: Script "still running" indefinitely after Playwright completes
- Root cause: Node process wrapping (cmd.exe → npx → tsx); .NET dotnet.exe simpler cleanup
- Workaround: Run language test suites manually with explicit cleanup instead of relying on script automation

**Impact:** Automation of cross-language E2E runs is blocked until Stop-Bot logic is refactored.
