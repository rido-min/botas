# API Doc Tooling Choices — Kif

**Date:** 2026-04-22  
**PR:** #226  
**Issue:** #224 — Add API Ref Docs to public website  
**Status:** Implemented

---

## Decision

Set up per-language API documentation generation tooling integrated with VitePress:

1. **DocFX** for .NET XML documentation
2. **TypeDoc** with markdown plugin for Node.js/TypeScript
3. **pdoc** for Python docstrings
4. **@viteplus/versions** for multi-version documentation selector

---

## Context

Issue #224 requested API reference documentation on the public docs site. Doc comments are already merged (PR #222). This PR handles Phase 2: tooling configuration and VitePress integration.

### Requirements
- Auto-generate API docs from source code comments (XML, JSDoc, docstrings)
- Integrate with existing VitePress docs site (`docs-site/`)
- Support versioned documentation (v0.3, v0.4, etc.)
- Minimal manual maintenance

### Prior Research
Documented in `.squad/decisions/inbox/kif-api-docs-research.md` (2026-07-15). Research covered tool options, VitePress plugins, and CD pipeline patterns.

---

## Tooling Choices

### .NET: DocFX
**Package:** `docfx` (v2.78.5+)  
**Why:**
- Standard tool for .NET API documentation
- Extracts XML comments from compiled assemblies and source projects
- Supports markdown output (configured via `docfx.json`)
- Integrates with MSBuild and Roslyn for source analysis
- Community-maintained but actively updated (supports .NET 10 frameworks)

**Alternative considered:** Sandcastle — rejected as older and less maintained.

**Config location:** `dotnet/docfx.json`

---

### Node.js: TypeDoc with markdown plugin
**Packages:** `typedoc`, `typedoc-plugin-markdown`  
**Why:**
- Most popular TypeScript doc generator
- Native Markdown output for VitePress integration (via plugin)
- Respects TypeScript types, JSDoc tags, and inheritance
- Active maintenance and ecosystem

**Alternative considered:** API Extractor + API Documenter — rejected as overkill for simple library docs (primarily for API surface management, not user-facing docs).

**Config location:** `node/packages/botas/typedoc.json`  
**npm script:** `npm run docs`

---

### Python: pdoc
**Package:** `pdoc` (v15+)  
**Why:**
- Lightweight and minimal setup
- Clean HTML output from docstrings
- Supports Google-style and NumPy-style docstrings
- Fast generation, no build files needed
- Actively maintained

**Alternative considered:**
- **Sphinx:** Too heavy for simple library docs; requires extensive configuration
- **pydoc-markdown:** Markdown output but less polished than pdoc

**Config:** CLI-only (no config file); installed in `python/packages/botas/pyproject.toml` dev dependencies.

---

### VitePress Version Selector: @viteplus/versions
**Package:** `@viteplus/versions`  
**Why:**
- Actively maintained for VitePress 2.x
- Provides version switcher dropdown in navbar
- Automatic route handling between versions
- Supports per-version sidebar navigation and localization

**Alternative considered:** `vitepress-plugin-version-select` — rejected as it **does not exist on npm** (mentioned in initial research but unavailable).

**Config location:** `docs-site/versions.json`  
**Theme integration:** Future work (plugin installed, not yet configured in theme)

---

## Implementation

### Files Created/Modified

**New configs:**
- `dotnet/docfx.json` — DocFX metadata and build config
- `node/packages/botas/typedoc.json` — TypeDoc entry point and markdown plugin
- `python/packages/botas/pyproject.toml` — Added `pdoc>=15` to dev dependencies

**VitePress integration:**
- `docs-site/api/dotnet.md` — Placeholder for .NET API docs
- `docs-site/api/nodejs.md` — Placeholder for Node.js API docs
- `docs-site/api/python.md` — Placeholder for Python API docs
- `docs-site/.vitepress/config.mts` — Added "API Reference" section to nav + sidebar
- `docs-site/versions.json` — Initial version entry (v0.3)
- `docs-site/package.json` — Added `@viteplus/versions` dependency

**Build script:**
- `docs-site/generate-api-docs.sh` — Bash script to run all 3 doc generators and copy output

---

## Verification

Tested with `cd docs-site && npm run docs:build` — build succeeds with new structure.

---

## Future Work

1. **CI Integration:** Automate doc generation in GitHub Actions on release (`.github/workflows/docs.yml`)
2. **Theme Configuration:** Wire up `@viteplus/versions` plugin in `.vitepress/theme/index.ts`
3. **Actual Doc Generation:** Run `generate-api-docs.sh` once all doc comments are finalized
4. **Version Management:** On each release, copy docs to versioned subfolder (e.g., `/botas/v0.3/`)

---

## References

- [DocFX](https://github.com/dotnet/docfx)
- [TypeDoc](https://typedoc.org/)
- [typedoc-plugin-markdown](https://typedoc-plugin-markdown.org/)
- [pdoc](https://pdoc.dev/)
- [@viteplus/versions](https://github.com/viteplus/versions)
- Issue #224: https://github.com/rido-min/botas/issues/224
- PR #226: https://github.com/rido-min/botas/pull/226
- Prior research: `.squad/decisions/inbox/kif-api-docs-research.md`

---

## Impact

✅ Infrastructure for API reference docs is now in place  
✅ VitePress site structure ready for generated API content  
✅ Per-language tooling configured and dependency-managed  
⏳ Actual API doc generation pending final doc comments review
