# Decisions Log

## Decision: Decisions Log Cleanup

**Author:** Leela (Lead)  
**Date:** 2026-04-15  
**Status:** Completed  

## Context

`.squad/decisions.md` had grown to 29KB with duplicate numbering, stale completed decisions, and missing entries for recent major changes (commits since v0.2.3 tag).

## Changes Made

### 1. Archived Completed Decisions (14 total)

Moved fully-implemented, no-longer-actionable decisions to Archived section with 1-line summaries:

- Jekyll docs scaffold (superseded by VitePress)
- docs/ folder reorganized
- Middleware docs enhancement
- RemoveMentionMiddleware implementations (.NET, Node, Python)
- BotApp Simplification docs
- Python parity fix
- VitePress migration
- Spec consolidation
- FluentCards adoption
- Auth setup restructure
- CD release job
- createReplyActivity spec gap resolved (from stale inbox item)

### 2. Added New Decisions (8 total)

Documented major changes from commits since v0.2.3:

- **#10: Node JWT Decoupling (PR #173)** — Decoupled JWT server middleware from botas-core
- **#11: Docs-site CI + Netlify Preview (PR #176)** — Added CI build with Netlify PR previews
- **#12: CI/CD Hardening (PR #177)** — SHA pinning, caching, concurrency controls
- **#13: E2E as Release Gate (PR #191)** — E2E tests now gate CD pipeline
- **#14: Release Process Formalized (PR #196, #197)** — `releasing.md` + GitHub Release creation
- **#15: botas-core Rename + Version Property (PR #198)** — Node package renamed; BotApplication.Version added
- **#16: Getting Started Revamp (PR #201)** — Code-first Teams bot onboarding guide
- **#17: Spec Restructure (PR #202)** — Condensed specs, reference docs, teams-activity promoted

### 3. Fixed Duplicate Numbering

Resolved duplicate decision numbers:
- Two #3s, two #4s, two #5s, two #12s → clean sequential 1-17

### 4. Resolved Stale Inbox Item

Moved `createReplyActivity` spec gap to archived section as resolved:
- **Problem:** AGENTS.md said implementations must copy channelId, but none did
- **Resolution:** Docs updated to match implementation (only copies serviceUrl and conversation)
- **Related:** .NET invoke skip also fixed in PR #150

## Results

| Metric | Before | After |
|--------|--------|-------|
| File size | 29KB | 10.7KB |
| Active decisions | Mixed | 17 |
| Archived decisions | 0 | 14 |
| Duplicate numbers | Yes | No |
| Stale inbox items | 1 | 0 |

## Impact

- **Under target:** 10.7KB < 15KB limit ✓
- **Current:** All major changes since v0.2.3 documented
- **Clean:** No duplicate numbering, no stale items
- **Focused:** Active decisions are recent and actionable
- **Archived:** Completed work preserved but condensed

## Files Modified

- `.squad/decisions.md` — cleaned and updated
- `.squad/decisions.md.backup` — original preserved
- `.squad/agents/leela/history.md` — learning appended
