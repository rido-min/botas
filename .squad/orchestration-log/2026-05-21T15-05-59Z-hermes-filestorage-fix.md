# Hermes · Python FileStorage Long-Path Fix

**Date:** 2026-05-21T15:05:59Z  
**Agent:** Hermes (claude-sonnet-4.5, background)  
**Request:** Rido  
**Status:** ✅ Complete

## Summary

Fixed Windows MAX_PATH (260-char) bug in Python FileStorage. Real-world Teams conversation IDs can produce filenames that exceed Windows limits when converted to absolute paths. Added transparent `\\?\` extended-length path prefix in `FileStorage._key_to_path()` when absolute path exceeds 240 chars on Windows.

## Changes

**File:** `python/packages/botas/src/botas/state/file_storage.py`
- Added platform check (`os.name == 'nt'`) and absolute path length check (>240 chars)
- Applied `\\?\` prefix only when both conditions are met
- No API changes; transparent to users

**Tests:** New regression test added (likely `tests/test_state_storage.py` or similar)
- Exercises 193-char Teams conversation ID (Rido's exact scenario)

## Parity Impact

**None.** Python-specific Windows workaround.
- .NET: Uses `Path.Combine()` + `Directory.CreateDirectory()` — no issue
- Node.js: Uses `path.join()` on all platforms — no issue
- Spec: No change required; platform-specific implementation detail

## Test Results

- **Python:** 205 passed, 11 skipped ✅
- **Ruff linting:** Clean ✅
- **Smoke test:** Confirmed with Rido's exact 193-char Teams conversation ID ✅

## Related

- Issue: Not formally filed; caught during manual testing
- PR reference: Will be included in follow-up PR for Issue #361 polish
