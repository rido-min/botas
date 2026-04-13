# Decisions Log

## Decision: createReplyActivity spec vs implementation gap

**Author:** Leela (Lead)  
**Date:** 2026-04-13  
**Status:** Needs resolution

### Context

AGENTS.md behavioral invariant #2 states:
> `createReplyActivity` MUST copy `serviceUrl`, `channelId`, `conversation`; swap `from`/`recipient`; set `replyToId`

**All three implementations** (dotnet, node, python) copy only `serviceUrl` and `conversation`, swap `from`/`recipient`, and set `type`/`text`. None copy `channelId` (the .NET `CoreActivity` doesn't even have a typed `ChannelId` property). None set `replyToId`.

Documentation has been corrected to match implementation. AGENTS.md still has the old spec.

### Decision needed

Either:
1. **Update AGENTS.md** to remove the `channelId` and `replyToId` requirements (match reality), or
2. **Update all three implementations** to actually copy `channelId` and set `replyToId` (match spec)

### Secondary finding

The .NET `ConversationClient.SendActivityAsync` silently skips `trace` and `invoke` activity types. Node.js and Python do not. This is a parity gap.
