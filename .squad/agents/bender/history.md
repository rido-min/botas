# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

### CI/CD Pipeline Security & Reliability Improvements (2026-04-16)

Implemented comprehensive CI/CD fixes based on security audit findings. All critical and should-fix items addressed:

**SHA Pinning (Security):**
- All GitHub Actions now pinned to full commit SHAs instead of mutable version tags
- Applied consistent pattern: `uses: owner/action@<sha> # <version>`
- Key SHAs used:
  - `actions/checkout@v6` → `de0fac2e4500dabe0009e67214ff5f5447ce83dd`
  - `actions/setup-node@v6` → `53b83947a5a98c8d113130e565377fae1a50d02f`
  - `actions/setup-dotnet@v5` → `c2fa09f4bde5ebb9d1777cf28262a3eb3db3ced7`
  - `actions/setup-python@v6` → `a309ff8b426b58ec0e2a45f0f869d46889d02405`
  - `dorny/paths-filter@v3` → `d1c1ffe0248fe513906c8e24db8ea791d46f8590`
  - `nwtgck/actions-netlify@v3` → `13eaa50a52af3944ac07286543eba6545d35aa08`
  - `actions/github-script@v7` → `f28e40c7f34bde8b3046d885e986cb6290c5673b`
  - `pypa/gh-action-pypi-publish@release/v1` → `cef221092ed1bacb1cc03d23a2d87d1d172e277b`
  - `actions/configure-pages@v5` → `983d7736d9b0ae728b81ab479565c72886d7745b`
  - `actions/upload-pages-artifact@v3` → `56afc609e74202658d3ffba0e8f6dda462b719fa`
  - `actions/deploy-pages@v4` → `d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e`

**SDK Standardization (Reliability):**
- Standardized all .NET SDK versions to `10.0.x` (removed inconsistent 8.0.x and preview flags)
- Removed `dotnet-quality: preview` from all workflows (project uses net10.0 stable TFM)
- Ensures CI and CD test against the same runtime environment

**Concurrency Management (Cost/Speed):**
- Added concurrency groups to CI.yml: `cancel-in-progress: true` (saves resources on rapid pushes)
- Added concurrency groups to CD.yml: `cancel-in-progress: false` (prevents deployment cancellations)

**Caching Improvements (Speed):**
- Added npm caching to docs.yml (`cache: 'npm'`, `cache-dependency-path: docs-site/package-lock.json`)
- Added pip caching to CI.yml python job (`cache: 'pip'`, `cache-dependency-path: python/packages/botas/pyproject.toml`)
- Upgraded docs.yml from setup-node@v4 to @v6 for latest cache features

**Python CD Auth Cleanup (Security):**
- Removed `id-token: write` from CD.yml python job (not using trusted publishing)
- Clarified auth model: using password-based API tokens for PyPI/TestPyPI

**Documentation:**
- Added clear comment to build-all.sh indicating it's build-only (tests run separately in CI)

**Squad Workflows:**
- Updated all squad-*.yml workflows from checkout@v4 to SHA-pinned v6 for consistency
- Reviewed token fallback pattern in squad-heartbeat.yml (working as designed)

**Pattern for future action updates:**
1. Use `git ls-remote https://github.com/<owner>/<action>.git refs/tags/<version>` to get SHA
2. For annotated tags, use the dereferenced commit SHA (the one shown with `^{}`)
3. Always add version comment: `@<sha> # <version>`
4. Update all workflows simultaneously to maintain consistency

All changes verified and passing validation checks.

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- **2026-04-16**: Joined the team as DevOps Engineer. Existing CI/CD structure: CI.yml (PR/push validation with dorny/paths-filter for dotnet/node/python/docs), CD.yml (publish to NuGet/npm/PyPI on main/release branches), docs.yml (GitHub Pages deployment on main), e2e.yml (end-to-end tests). Key patterns: path-filtered jobs, action versions (checkout@v6, setup-node@v6, setup-dotnet@v5, setup-python@v6), nbgv for versioning across all languages.
- **2026-04-16**: Added `docs-preview.yml` workflow for Netlify deploy previews on PRs (path-filtered to `docs-site/**`). Uses `nwtgck/actions-netlify@v3` with `production-deploy: false`. Requires `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` secrets. Removed artifact upload from CI.yml docs job — CI still validates the build, but previews are now handled by the dedicated Netlify workflow. Production docs remain on GitHub Pages via `docs.yml`.
- **2026-04-16**: Full CI/CD review completed. Top findings: (1) All actions pinned by mutable tags not SHAs — security risk. (2) .NET SDK version inconsistency: CI uses 10.0.x stable, CD uses 10.0.x preview, python jobs use 8.0.x. (3) No concurrency groups on CI/CD. (4) docs.yml uses setup-node@v4 while all others use @v6. (5) Squad workflows all on checkout@v4 vs @v6 elsewhere. (6) Python CI missing pip cache. (7) CD python has both id-token:write and password-based PyPI auth — conflicting patterns. Full report in `.squad/decisions/inbox/bender-cicd-review.md`.
- **2026-04-16**: Consolidated three API documentation branches (squad/224-dotnet-api-docs, squad/224-node-api-docs, squad/224-python-api-docs) into a single PR (squad/224-api-docs). Created new branch from main, merged each language-specific branch with --no-ff to preserve commit history. All merges were conflict-free since each touched different language directories. PR #225 includes 37 files changed (14 .NET, 11 Node.js, 12 Python) with 1,687 lines of documentation (XML docs, JSDoc, docstrings). Pattern for multi-language feature consolidation: create feature branch from main, merge language-specific branches sequentially with descriptive commit messages.

- **2026-04-22**: Orchestration role — After Amy, Fry, and Hermes completed language-specific API doc work (XML for .NET, JSDoc for Node.js, docstrings for Python), consolidated all three branches into squad/224-api-docs and opened PR #225 (Fixes #224). Scope: 1,687 total lines of doc comments across all languages. Bender's role: handle cross-branch integration and ensure single cohesive PR for easier review. PR #225 successfully merged all language implementations.

