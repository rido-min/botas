# Session: Python FileStorage Windows MAX_PATH Fix

**Timestamp:** 2026-05-21T15:05:59Z  
**Agent:** Hermes  
**Status:** Done

Fixed Windows path length bug in Python FileStorage. Conversation IDs > 193 chars triggered FileNotFoundError. Added `\\?\` extended-length path prefix when absolute path > 240 chars. Parity impact: none (Python-specific). Tests: 205 passed, 11 skipped. Smoke test confirmed with Rido's exact scenario.
