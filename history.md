# E2E Test Suite History

## 2026-05-21: Consolidation to cross-language.spec.ts (Nibbler)

**Cleaned up orphaned per-language test files:**
- Deleted: `e2e/playwright/tests/echo-bot.spec.ts`, `counter-bot.spec.ts`, `invoke-bot.spec.ts`, `submit-bot.spec.ts`, `mention-bot.spec.ts`
- Reason: These single-language tests have been superseded by `cross-language.spec.ts`, which runs all 5 scenarios (echo, counter, mention, submit, invoke) × 3 languages (dotnet, node, python) in a single orchestrated browser session.
- Verification: No unique test coverage was lost. All scenarios are now tested consistently across all three languages with shared bot lifecycle management.
- Result: Test count reduced from 21 to exactly 16 tests (15 cross-language + 1 auth-setup).
- Charter updated: `.squad/agents/nibbler/charter.md` now reflects only `cross-language.spec.ts` as the canonical test suite.
