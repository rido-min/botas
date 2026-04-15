# Decision: CD Release Job

**Author:** Leela  
**Date:** 2026-04-15  
**Status:** Implemented  

## Context

The CD workflow builds and publishes packages for all three languages on `release/**` branches but did not create a GitHub Release to mark the version.

## Decision

Added a `release` job to `.github/workflows/CD.yml` that:

1. **Runs only on `release/**` branches** — gated by `startsWith(github.ref, 'refs/heads/release/')`.
2. **Depends on all three language jobs** (`dotnet`, `node`, `python`) via `needs:`.
3. **Tolerates skipped jobs** — uses `if: always()` combined with `!contains(needs.*.result, 'failure') && !contains(needs.*.result, 'cancelled')` so the release fires even when path-filter skips some languages, but blocks if any job actually fails.
4. **Job-level `contents: write`** — overrides the workflow-level `contents: read` so `gh release create` can push tags and releases.
5. **Uses nbgv `SimpleVersion`** for the tag (`v0.1.42` format).
6. **Uses `gh release create --generate-notes`** — GitHub's built-in release notes generator, simpler than `actions/create-release`.

## Alternatives Considered

- `actions/create-release` — more verbose, requires more config, and is archived.
- Manual changelog — unnecessary overhead; GitHub's auto-generated notes from PR titles are sufficient for this project's cadence.

## Impact

- No changes to existing jobs or permissions.
- Release job is additive and only activates on `release/**` branches.
- All three languages benefit from a single coordinated release tag.
