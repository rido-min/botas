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

- **2026-04-22**: Added versioned docs deployment to CD.yml. New `docs` job runs after `release` succeeds on release branches/tags. Uses gh-pages branch strategy (not actions/deploy-pages) to preserve versioned subdirectories across deployments. Each release deploys to both root (latest) and `v{version}/`. rsync with `--exclude='v[0-9]*'` preserves prior version directories. API docs generated for all 3 languages via `docs-site/generate-api-docs.sh` before VitePress build. Key decision: gh-pages branch over deploy-pages action because deploy-pages replaces the entire site, destroying prior versions.

- **2026-04-23**: Tag `v0.3.25-alpha` CD run (#24853753915) failed. Root cause: `python-fastapi` job (PR #233) failed on first-ever PyPI publish. The job has `id-token: write` which causes `pypa/gh-action-pypi-publish` to prefer OIDC trusted publishing over the API token password. PyPI rejects OIDC for **new** projects that don't have a trusted publisher pre-configured ("Non-user identities cannot create new projects"). Fix requires either: (a) registering `botas-fastapi` as a trusted publisher on pypi.org, or (b) removing `id-token: write` from the python-fastapi job so password auth is used. The `python` (botas) job also has `id-token: write` but works because the project already exists on PyPI. All other CD jobs (changes, python, dotnet, node) succeeded. `release` and `docs` were skipped because `release` depends on all jobs passing (`!contains(needs.*.result, 'failure')`). CI.yml didn't trigger — expected, since it only runs on `push: [main]` and PRs, not tags. Version stamping is correct: nbgv produced `0.3.25` from the tag.

- **2026-04-23**: Fixed docs version selector accumulation bug (PR #235). The CD docs job was overwriting `versions.json` on gh-pages each deploy instead of merging with existing versions. Fix: save existing `versions.json` from gh-pages before rsync, then merge+deduplicate+sort after. Also made VersionBadge read dynamically from `versions.json` instead of hardcoding. Pattern: when gh-pages deployment preserves directories via rsync excludes, any metadata files (like versions.json) need the same preservation treatment — save before overwrite, merge after.

- **2026-04-23**: Completed DocFX + VitePress integration spike. Installed DocFX v2.78.5 and xmldocmd v2.9.0, then tested both tools on the Botas .NET library. **Findings**: (1) DocFX metadata generation works flawlessly — created 35 YML files covering all types/members from Botas.csproj. Quality is high, structure is well-organized per type. (2) DocFX HTML output via "default" template succeeds, producing complete HTML site with styles/assets. (3) **Critical blocker**: DocFX v2.78 does NOT support markdown output. The web suggests a "dfm" template exists, but it's not bundled—tested and confirmed template not found. The "outputType: markdown" config option also doesn't work. **Conclusion**: Markdown-for-VitePress integration is **not viable** with DocFX v2.78. (4) xmldocmd v2.9.0 failed on .NET 10 compatibility (System.Runtime assembly loading error). **Recommendation**: Use **fallback path**—generate DocFX HTML as a standalone site (`dotnet tool install docfx`, `docfx metadata`, `docfx build` with "default" template), output to `docs-site/api/dotnet-apidocs/`, link from VitePress nav. This gives a professional, fully-featured API reference without VitePress markdown overhead. CD workflow update: insert metadata+build steps into `generate-api-docs.sh` before VitePress build.

- **2026-04-23**: Replaced DefaultDocumentation with DocFX in `docs-site/generate-api-docs.sh`. Key changes: (1) Removed `sanitize_dotnet_docs()` function and DefaultDocumentation block (was lines 10-98). (2) New .NET section uses `docfx metadata` + `docfx build` from repo root with `docfx.json`. (3) Updated `docfx.json` template from broken `["dfm"]` to `["default", "modern"]`, output to `docs-site/api/generated/dotnet`. (4) Fixed Node.js `cd` path from `cd ../node/packages/botas-core` to `cd node/packages/botas-core` since CWD changed from `dotnet/` to repo root. (5) Added `rm -rf docs-site/api/generated/dotnet` cleanup before generation. Script CWD flow verified: docs-site → repo root (DocFX) → node/packages/botas-core → botas-express → python/packages/botas → botas-fastapi.

