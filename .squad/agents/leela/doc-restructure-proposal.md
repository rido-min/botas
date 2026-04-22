# Documentation Restructuring Proposal
**Requested by:** Rido  
**Prepared by:** Leela (Lead)  
**Date:** 2026-04-13  

## Current State Analysis

### Existing Structure

1. **README.md** (GitHub landing page)
   - Setup-first approach: Prerequisites → Tunnel → Teams CLI → Run bot → Try it
   - Covers: Teams CLI, dev tunnel, language runtime
   - Full working quickstart with env setup
   - Links to full docs site

2. **docs-site/getting-started.md**
   - Code-first approach: Code in 5 seconds → Talk to bot → Setup check (if needed)
   - Intentionally defers setup details
   - Links to auth-setup.md for full setup

3. **docs-site/auth-setup.md**
   - Two-auth model conceptual explanation
   - Full Teams CLI tutorial
   - Dev tunnel setup
   - Environment variables
   - .NET configuration details
   - Azure Portal appendix (manual setup without Teams CLI)

4. **docs-site/index.md**
   - Hero landing page with echo bot examples
   - Quick links to all major sections

### Problems Identified

1. **Duplication**: README and auth-setup.md both teach Teams CLI + dev tunnel setup
2. **Conceptual mixing**: auth-setup.md combines "how auth works" (conceptual) with "how to get credentials" (practical)
3. **Structural misalignment**: README is setup-first, getting-started.md is code-first (though getting-started's approach is better)
4. **Unclear boundaries**: When should someone read README vs getting-started vs auth-setup?

---

## Option 1: "Lean README, Rich Docs Site"

### Changes

**README.md**
- Remove all detailed setup steps
- Keep only: Prerequisites list (Teams CLI, dev tunnel, language runtime) + single command snippet
- Focus on "here's what botas is, here's the code, go to docs for full setup"
- Echo bot code examples for all 3 languages
- Strong CTA to docs-site/getting-started.md

**docs-site/getting-started.md** (Keep code-first, expand inline setup)
- Step 1: Code in 5 seconds (unchanged)
- Step 2: Talk to bot (unchanged)
- Step 3: Expand setup check into mini-tutorial
  - Inline Teams CLI + dev tunnel commands (lifted from auth-setup.md)
  - Inline `.env` creation
  - Keep it practical, skip conceptual auth explanation
- Link to auth-setup.md only for "how auth works" deep dive

**docs-site/auth-setup.md** → **docs-site/authentication.md** (Rename, conceptual focus)
- **Part 1: How Auth Works** (conceptual)
  - Two-auth model explanation
  - Inbound JWT validation
  - Outbound OAuth2 client credentials
  - Link to specs/architecture.md for technical details
- **Part 2: Advanced Setup** (practical)
  - Azure Portal manual setup (without Teams CLI)
  - Custom tenant configuration
  - Troubleshooting auth failures
  - Environment variable reference

### Pros
- ✅ Clean separation: README is marketing, getting-started is tutorial, authentication is reference
- ✅ Minimal duplication (setup instructions in one place: getting-started.md)
- ✅ GitHub visitors get a fast overview without drowning in setup details
- ✅ Respects getting-started.md's code-first philosophy
- ✅ "Authentication" becomes a deep-dive for those who need it

### Cons
- ⚠️ README loses "complete quickstart" quality — users must click through to docs
- ⚠️ Renaming auth-setup.md breaks existing links (mitigate with redirect in Jekyll)
- ⚠️ Setup instructions live in getting-started.md, which might feel cramped

---

## Option 2: "Self-Contained README, Focused Docs"

### Changes

**README.md** (Keep complete quickstart, align to code-first)
- Reorder to match getting-started.md: Code first, setup second
- Section 1: "Echo Bot Examples" (all 3 languages)
- Section 2: "Prerequisites" (Teams CLI, dev tunnel, runtime)
- Section 3: "Setup" (collapsed details, Teams CLI + tunnel commands)
- Section 4: "Try it"
- Section 5: "Learn more" (link to docs)
- Keep it self-contained but optimize for GitHub quick-start

**docs-site/getting-started.md**
- No changes (already code-first and good)
- Continue to link to setup-guide.md for those who need more

**docs-site/auth-setup.md** → **docs-site/setup-guide.md** (Rename, split clearly)
- **Part 1: Setup Tutorial** (practical, step-by-step)
  - Teams CLI walkthrough
  - Dev tunnel walkthrough
  - Env vars creation
  - .NET launchSettings bridge script
  - Testing your bot
  - Common gotchas
- **Part 2: How Authentication Works** (conceptual)
  - Two-auth model
  - Inbound/outbound flows
  - Link to specs/architecture.md
- **Part 3: Manual Setup (Azure Portal)** (appendix)
  - Full portal walkthrough (no Teams CLI)

### Pros
- ✅ README remains complete and GitHub-friendly (can start without leaving GitHub)
- ✅ Clear internal structure: setup-guide.md has tutorial → concept → manual fallback
- ✅ getting-started.md stays lean and code-first (unchanged)
- ✅ All docs link to one canonical setup guide

### Cons
- ⚠️ Duplication remains: README and setup-guide.md both cover Teams CLI + tunnel
- ⚠️ README still longer than typical GitHub quickstarts
- ⚠️ Renaming file breaks existing links

---

## Option 3: "Tiered Setup Path" (Recommended)

### Changes

**README.md** (Minimal setup, code-first)
- Lead with echo bot code (all 3 languages)
- Prerequisites: "You need Teams CLI, dev tunnel, and credentials. [Full setup guide →](link)"
- One-liner: `teams app create --name "MyBot" --endpoint "https://<tunnel>/api/messages"`
- Run commands for all 3 languages
- Link to docs-site/getting-started.md for interactive tutorial

**docs-site/getting-started.md** (Keep code-first, link to setup checklist)
- No structural changes
- Step 3 "Setup Check" expands slightly to include:
  - Inline checklist (Teams CLI installed? Tunnel running? .env created?)
  - Link to setup.md for "If you're missing any of these, start here"

**NEW: docs-site/setup.md** (Practical setup tutorial, no auth concepts)
- **Title:** "Setup Guide"
- **Target:** Someone who needs step-by-step setup from zero
- **Content:**
  - Install Teams CLI
  - Install dev tunnel
  - Create tunnel and get URL
  - Run `teams app create`
  - Save credentials to `.env`
  - .NET-specific: run env-to-launch-settings.mjs
  - Test your bot
  - Common gotchas table
- **Explicitly NOT covered here:** How auth works (that's in authentication.md)

**docs-site/auth-setup.md** → **docs-site/authentication.md** (Conceptual only)
- **Title:** "How Authentication Works"
- **Target:** Someone who wants to understand the two-auth model, troubleshoot auth failures, or do manual Azure Portal setup
- **Content:**
  - Part 1: Two-auth model (inbound JWT, outbound OAuth2)
  - Part 2: Under the hood (JWKS fetching, token caching, signature validation)
  - Part 3: Azure Portal manual setup (appendix for those who can't use Teams CLI)
  - Part 4: Troubleshooting auth failures

**Update all links:**
- "Need setup?" → link to setup.md
- "How does auth work?" → link to authentication.md

### Pros
- ✅ **Zero duplication**: Setup instructions in one place (setup.md)
- ✅ **Clean separation**: README (marketing), getting-started (code-first), setup (practical tutorial), authentication (conceptual reference)
- ✅ **README stays lean** but remains useful for GitHub visitors
- ✅ **Tiered learning path**: Code first → setup if needed → auth concepts if curious
- ✅ **Respects getting-started.md's code-first philosophy**
- ✅ **Clear scoping**: setup.md is "how to get running", authentication.md is "how it works + manual setup"

### Cons
- ⚠️ Creates a new file (setup.md) — slight increase in file count
- ⚠️ Renaming auth-setup.md breaks existing links (mitigate with Jekyll redirect)
- ⚠️ Requires updates to nav in docs-site and multiple cross-references

---

## Recommendation: Option 3 ("Tiered Setup Path")

### Why Option 3?

1. **Eliminates duplication** — setup instructions live in exactly one place
2. **Respects user intent**:
   - GitHub visitor: Quick overview in README, link to full docs
   - New developer: Code-first in getting-started.md, setup.md if needed
   - Troubleshooter: authentication.md for auth deep-dive
3. **Aligns with getting-started.md's code-first philosophy** — setup is explicitly deferred and optional
4. **Clean conceptual boundaries**:
   - setup.md = "how to get credentials and run your bot" (practical)
   - authentication.md = "how the two-auth model works" (conceptual)
5. **Future-proof**: Clear places to add content (e.g., Azure Portal manual setup stays in authentication.md as an appendix)

### Implementation Checklist

- [ ] Create `docs-site/setup.md` with practical tutorial content (lift from auth-setup.md)
- [ ] Rename `docs-site/auth-setup.md` → `docs-site/authentication.md`
- [ ] Restructure `authentication.md`: Part 1 (two-auth model), Part 2 (under the hood), Part 3 (Azure Portal appendix), Part 4 (troubleshooting)
- [ ] Update README.md: Lead with code, minimal setup mention, link to getting-started.md
- [ ] Update `getting-started.md`: Expand Step 3 checklist, link to setup.md for missing pieces
- [ ] Update `docs-site/index.md`: Update link from "Authentication & Setup" → "Setup Guide" and add "Authentication" to quick links
- [ ] Update navigation in `docs-site/_config.yml` or nav file
- [ ] Add Jekyll redirect from `auth-setup.html` → `authentication.html`
- [ ] Grep all docs for `auth-setup.md` and update links

### Open Questions

1. Should setup.md cover dev tunnel alternatives (ngrok, etc.)? **Suggest:** Yes, as a collapsed details block
2. Should authentication.md cover token expiration and refresh? **Suggest:** Yes, in "Under the Hood" section
3. Should README.md link directly to setup.md or only to getting-started.md? **Suggest:** Only to getting-started.md (maintain code-first flow)

---

## Summary Table

| File | Role | Key Content | Target Audience |
|------|------|-------------|-----------------|
| **README.md** | Marketing quickstart | Echo bot code, link to docs | GitHub visitors |
| **docs-site/getting-started.md** | Code-first tutorial | Code → test → setup checklist | New developers |
| **docs-site/setup.md** (NEW) | Practical setup guide | Teams CLI, tunnel, .env, run | Developers needing setup |
| **docs-site/authentication.md** (RENAMED) | Auth deep-dive | Two-auth model, troubleshooting, manual setup | Curious developers, troubleshooters |

