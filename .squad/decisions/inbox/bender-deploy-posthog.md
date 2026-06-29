# Decision: PostHog Key Injection for Docs Deployment

**Date**: 2026-06-29  
**Author**: Bender (DevOps)  
**Status**: Implemented  
**Branch**: `feat/docs-posthog-deploy` (stacked on `feat/telemetry-base`)

---

## Context

The docs-site (VitePress) integrates PostHog analytics for tracking usage patterns. PostHog configuration requires two environment variables at **Vite build time**:
- `VITE_POSTHOG_KEY`: PostHog project API key (secret)
- `VITE_POSTHOG_HOST`: PostHog instance URL (defaults to `https://us.i.posthog.com`)

Vite inlines environment variables prefixed with `VITE_` at build time, so these cannot be injected at runtime — they must be present during the `npm run docs:build` step.

The workflows currently deploy with a placeholder key (`phc_PLACEHOLDER_...`) that intentionally does not send telemetry. To enable real analytics in production and preview deploys, the GitHub Actions workflows must inject the actual PostHog key from GitHub secrets.

---

## Decision

### Changes Made

1. **Updated `.github/workflows/docs.yml`** (GitHub Pages deployment):
   - Added `env` block to "Build VitePress site" step:
     ```yaml
     env:
       VITE_POSTHOG_KEY: ${{ secrets.POSTHOG_KEY }}
       VITE_POSTHOG_HOST: ${{ vars.POSTHOG_HOST || 'https://us.i.posthog.com' }}
     ```

2. **Updated `.github/workflows/docs-preview.yml`** (Netlify preview deployment):
   - Added `env` block to "Build" step:
     ```yaml
     env:
       VITE_POSTHOG_KEY: ${{ secrets.POSTHOG_KEY }}
       VITE_POSTHOG_HOST: ${{ vars.POSTHOG_HOST || 'https://us.i.posthog.com' }}
     ```

3. **Updated `docs-site/observability.md`**:
   - Documented GitHub Actions deployment requirements
   - Provided exact `gh` CLI commands for setting secrets/variables
   - Split configuration into "Local Development" and "GitHub Actions Deployment" sections

### Deployment Requirements

For rido to enable PostHog analytics in deployed docs:

**Required (secret):**
```bash
gh secret set POSTHOG_KEY --body "phc_YOUR_REAL_KEY_HERE"
```

**Optional (variable, defaults to `https://us.i.posthog.com`):**
```bash
gh variable set POSTHOG_HOST --body "https://us.i.posthog.com"
```

### Graceful Degradation

If `POSTHOG_KEY` is not set, the build proceeds with the placeholder key. No telemetry is sent, but the deployment does not fail. This allows:
- Forks to deploy without needing PostHog credentials
- Preview deploys to work immediately without configuration

---

## Alternatives Considered

1. **Runtime injection via SPA config**:
   - Not possible — Vite inlines `import.meta.env.VITE_*` at build time
   - Would require server-side rendering or a runtime config endpoint

2. **Store key in repository (committed `.env` file)**:
   - Rejected — secrets must not be committed to source control
   - GitHub secrets are the correct mechanism for sensitive deployment config

3. **Require secret to be set (fail build if missing)**:
   - Rejected — breaks forks and complicates PR previews
   - Graceful degradation (placeholder key) is better for open-source projects

---

## Verification

✅ YAML syntax validated (indentation, key structure)  
✅ `secrets.POSTHOG_KEY` uses GitHub Secrets (encrypted)  
✅ `vars.POSTHOG_HOST` uses GitHub Variables (plaintext, defaults to `https://us.i.posthog.com`)  
✅ Build no-ops cleanly if `POSTHOG_KEY` is unset (placeholder key used)  
✅ Documentation updated with exact `gh` commands

---

## Next Steps

1. Rido runs the `gh secret set` and `gh variable set` commands (see above)
2. Merge this PR into `feat/telemetry-base` (or fold into PR #377)
3. When `feat/telemetry-base` merges to `main`, the next docs deploy will use the real PostHog key
4. Verify analytics in PostHog dashboard after first deploy

---

## References

- PR #377: `feat/telemetry-base` (docs analytics baseline)
- `docs-site/.env.example`: PostHog configuration example
- `docs-site/observability.md`: User-facing documentation (updated)
- GitHub Actions docs: [Using secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions)
