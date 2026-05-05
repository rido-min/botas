# Decision: Node.js Samples Are Not Type-Checked in CI

**Author:** Leela (Lead)  
**Date:** 2025-05-03  
**Status:** Proposed  
**Triggered by:** Rido's manual fixes on `fix/samples-0503`

---

## Problem Statement

Four node samples (`02-advanced-hosting-koa`, `03-teams-features`, `04-ai-langchain-mcp`, `04-ai-vercel`) shipped with type errors, wrong API usage, and incorrect imports that were only caught by manual review. The question: why didn't CI catch any of this?

## Root Cause Analysis

### Finding 1: Samples have NO `build` script

Every sample uses `tsx` for runtime transpilation (`node --import tsx index.ts`). None define a `"build"` script in their `package.json`. CI runs:

```yaml
- name: Build
  run: npm run build
```

Which expands to `npm run build --workspaces --if-present`. The `--if-present` flag means samples are **silently skipped** because they lack a build script.

### Finding 2: No `tsc --noEmit` step exists anywhere

Even samples that have a `tsconfig.json` (koa, hono, langchain-mcp, vercel, langchain-otel) never get type-checked — there's no CI step that runs `tsc --noEmit` against them.

### Finding 3: Samples ARE in workspaces but get zero validation

`node/package.json` declares `"workspaces": ["packages/*", "samples/*"]`. Samples participate in dependency resolution (good), but get no build, lint, or type-check pass.

### Finding 4: Some samples lack tsconfig.json entirely

`01-echo-bot`, `03-teams-features`, `02-advanced-hosting-express`, `02-advanced-hosting-deno`, `05-observability`, `test-bot` have no tsconfig. These run via `tsx` only and would need a tsconfig added for type-checking.

## Gap Summary

| Gap | Impact | Examples caught |
|-----|--------|----------------|
| No `tsc --noEmit` on samples | Type errors, wrong API usage invisible | koa wrong tsconfig extends, teams casting `as Record<string,unknown>` |
| No import validation | Wrong/missing imports pass silently | langchain-mcp using `StdioClientTransport` instead of `StreamableHTTPClientTransport` |
| No build script in samples | `npm run build` skips all samples | All four fixes |
| No lint pass on samples | Anti-patterns (bypassing typed API) not flagged | teams casting away types |

## Recommendations

### R1: Add `tsc --noEmit` CI step for all samples (HIGH PRIORITY)

Add a `"typecheck"` script to each sample that has a tsconfig:

```json
"scripts": {
  "typecheck": "tsc --noEmit"
}
```

For samples without tsconfig, add a minimal one. Then add a CI step:

```yaml
- name: Typecheck samples
  run: npx tsc --noEmit --project samples/02-advanced-hosting-koa/tsconfig.json
  # repeat per sample, or use a script that iterates
```

**Alternative (simpler):** Add a root-level script that finds all sample tsconfigs:

```json
"scripts": {
  "typecheck:samples": "for dir in samples/*/; do [ -f \"$dir/tsconfig.json\" ] && tsc --noEmit -p \"$dir/tsconfig.json\"; done"
}
```

### R2: Ensure every sample has a tsconfig.json

Samples that rely only on `tsx` get zero static analysis. Every sample should have at minimum:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "target": "ESNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["index.ts"]
}
```

### R3: Run ESLint on samples in CI

The root `eslint.config.js` should already cover samples (they're in the workspace). Verify with:

```yaml
- name: Lint (includes samples)
  run: npm run lint
```

If samples are excluded by the eslint config, include them.

### R4: Consider a `sendTyping()` lint rule (LOW PRIORITY)

A custom eslint rule that warns when an `async` handler calls LLM/AI functions without a preceding `ctx.sendTyping()` would be nice but is complex to implement. For now, document it as a sample best practice in `AGENTS.md` or a `node/samples/README.md`.

### R5: Smoke-boot test (FUTURE)

A CI step that `import()`s each sample's entry point (with mocked env vars) to verify the module graph resolves. This catches wrong imports like `StdioClientTransport` when the package doesn't even export it for the configured use case.

---

## Proposed CI Change (Minimal)

Add after the existing Build step in `.github/workflows/CI.yml`:

```yaml
- name: Typecheck samples
  run: |
    for dir in samples/*/; do
      if [ -f "$dir/tsconfig.json" ]; then
        echo "Checking $dir..."
        npx tsc --noEmit -p "$dir/tsconfig.json"
      fi
    done
```

This single addition would have caught **all four** of Rido's fixes.

---

## Decision Needed

- [ ] Approve R1+R2 (typecheck all samples in CI)
- [ ] Approve R3 (lint samples in CI)
- [ ] Defer R4 (sendTyping lint rule)
- [ ] Defer R5 (smoke-boot test)
