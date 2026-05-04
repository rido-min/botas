# Teams Features

**Category:** 3 — Teams Features
**Language:** Node.js
**Complexity:** Intermediate

## What This Sample Demonstrates

- Teams-specific activity types (mentions, reactions, installationUpdate)
- Adaptive Cards and Teams card builders
- Invoke activities and task modules
- RemoveMentionMiddleware for clean message parsing
- Teams conversation update events

## Prerequisites

- Node.js 20+
- Azure Bot registration with Teams channel enabled
- Teams app manifest (for local testing with Teams Toolkit or dev tunnel)

## Run

```bash
npx tsx program.ts
```

## Key Files

- `program.ts` — Bot setup with Teams-specific handlers and middleware

## Learn More

- [Teams Bot docs](https://learn.microsoft.com/microsoftteams/platform/bots/what-are-bots)
