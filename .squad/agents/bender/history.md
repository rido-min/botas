# Project Context

- **Owner:** Rido
- **Project:** botas — multi-language Bot Framework library (.NET, Node.js, Python)
- **Stack:** C#/.NET, TypeScript/Node.js, Python — ASP.NET Core, Express, Hono, aiohttp, FastAPI
- **Created:** 2026-04-13

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- **2026-04-16**: Joined the team as DevOps Engineer. Existing CI/CD structure: CI.yml (PR/push validation with dorny/paths-filter for dotnet/node/python/docs), CD.yml (publish to NuGet/npm/PyPI on main/release branches), docs.yml (GitHub Pages deployment on main), e2e.yml (end-to-end tests). Key patterns: path-filtered jobs, action versions (checkout@v6, setup-node@v6, setup-dotnet@v5, setup-python@v6), nbgv for versioning across all languages.
- **2026-04-16**: Added `docs-preview.yml` workflow for Netlify deploy previews on PRs (path-filtered to `docs-site/**`). Uses `nwtgck/actions-netlify@v3` with `production-deploy: false`. Requires `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` secrets. Removed artifact upload from CI.yml docs job — CI still validates the build, but previews are now handled by the dedicated Netlify workflow. Production docs remain on GitHub Pages via `docs.yml`.
