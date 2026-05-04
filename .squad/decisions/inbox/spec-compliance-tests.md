# Design: Spec Compliance Tests (citation verification)

**Date:** 2026-05-04
**Status:** Proposal — design only, not implemented
**Scope:** A lightweight CI mechanism to detect when specs in `specs/` drift from the code they claim to describe.

---

## 1. Problem Statement

Recent merges show repeated drift between `specs/` and the three implementations:

- **#338** (`docs(specs): fix auth and env var inaccuracies`) — `outbound-auth.md` cited a non-existent `.NET TokenManager.cs`; env var notes blurred Node/Python-only flags as cross-language; `inbound-auth.md` referenced wrong Python module.
- **#335** (`docs(specs): fix stale sample paths`) — `samples.md`, `setup.md`, and `README.md` pointed at sample directories that had been renamed (`echo-bot` → `01-echo-bot`).
- **#334**, **#310**, **#285**, **#264** — recurring "fix stale spec" commits over the last several weeks.

The pattern: code is renamed or moved, the spec is not updated in the same PR, and the inaccuracy is only discovered in a later spot-audit. With 19 spec files and 3 language ports, manual audits don't scale, and the existing `grep -rn 'oldPattern'` checklist in `AGENTS.md` is purely advisory.

**What we want:** a cheap, mechanical check that catches at least the "this spec cites a file/symbol that no longer exists" class of drift, *before* a PR merges.

What we do **not** want:
- A "spec ↔ code" formal correspondence proof (out of scope, would dwarf the spec).
- Heavy tooling that spec authors have to learn before they can write a paragraph.

---

## 2. Proposed Approach

### Decision: Option A (frontmatter) + symbol anchors, **no line numbers**.

Front-matter YAML at the top of each spec lists the files and symbols the spec implements/describes. The CI script verifies each citation resolves to a real file and that the named symbol/anchor still appears in it.

```markdown
---
implements:
  dotnet:
    - path: dotnet/src/Botas/CoreActivity.cs
      anchor: "public class CoreActivity"
    - path: dotnet/src/Botas/BotApplication.cs
      anchor: "public class BotApplication"
  node:
    - path: node/packages/botas-core/src/core-activity.ts
      anchor: "export interface CoreActivity"
  python:
    - path: python/packages/botas/src/botas/core_activity.py
      anchor: "class CoreActivity"
---

# Activity Schema Spec
...
```

**Why this over the alternatives:**

| Option | Verdict | Why |
|---|---|---|
| **A. Frontmatter + anchor (chosen)** | ✅ | One block per spec, no inline noise; anchors survive line-number churn; YAML is structured enough for tooling but readable enough for humans. |
| B. Inline `<!-- impl: path:lines -->` comments per claim | ❌ | Higher per-claim fidelity, but clutters prose, and most spec paragraphs make claims that don't map cleanly to a single file. We tried inline citations once in `outbound-auth.md`; they decayed. |
| C. Separate `specs/citations.json` | ❌ | Citations live far from the prose they describe, making them easy to forget on edits. Harder for reviewers to spot stale entries on a PR diff. |
| D. Existing tool | ⚠️ | Surveyed: `dprint`, `markdownlint`, `cspell`, `lychee` (link checker) — none verify code citations. `runme`/`mdtest` execute fenced blocks but don't model "this spec implements X". `docusaurus-plugin-typedoc` ties docs to TypeScript symbols only, doesn't help across .NET/Python. No off-the-shelf fit; build a 50-line script. |

**Why no line numbers:** every shift, comment, or reformat invalidates them. False-positive rate from a 1-week trial would almost certainly drown the signal. Anchor strings (e.g. `"public class CoreActivity"`) shift only on rename/refactor — exactly the events we *want* to catch.

**Optional second tier:** a citation may add `lines:` for cases where the anchor is too coarse (e.g., specifying a *region* of a large file). The script treats `lines:` as a soft hint (warning if the anchor moved out of range, not failure).

```yaml
- path: node/packages/botas-core/src/bot-application.ts
  anchor: "async processActivity"
  lines: 60-130   # optional, warning-only
```

---

## 3. CI Script Design

### Language: Python

Reasons: already required for the Python package; no new toolchain dependency for contributors; `pyyaml` + stdlib is enough; cross-platform without PowerShell-isms.

Location: `scripts/check_spec_citations.py`, invoked from a new CI job `spec-citations` in `.github/workflows/CI.yml`.

### Pseudocode

```python
# scripts/check_spec_citations.py
import sys, re, yaml, pathlib

REPO = pathlib.Path(__file__).resolve().parents[1]
SPECS = REPO / "specs"

errors = []
warnings = []

for spec in SPECS.rglob("*.md"):
    text = spec.read_text(encoding="utf-8")
    fm = parse_frontmatter(text)         # returns {} if no ---...--- block
    if not fm or "implements" not in fm:
        continue                          # opt-in; missing is not an error (yet)

    for lang, citations in fm["implements"].items():
        for cite in citations:
            path = REPO / cite["path"]
            if not path.exists():
                errors.append(f"{spec.relative_to(REPO)}: missing file {cite['path']}")
                continue

            content = path.read_text(encoding="utf-8", errors="replace")
            anchor = cite.get("anchor")
            if anchor and anchor not in content:
                errors.append(
                    f"{spec.relative_to(REPO)}: anchor not found in "
                    f"{cite['path']}: {anchor!r}"
                )
                continue

            lines = cite.get("lines")     # optional, format "10-50"
            if anchor and lines:
                start, end = map(int, lines.split("-"))
                anchor_line = next(
                    (i+1 for i, l in enumerate(content.splitlines()) if anchor in l),
                    None,
                )
                if anchor_line and not (start <= anchor_line <= end):
                    warnings.append(
                        f"{spec.relative_to(REPO)}: anchor moved out of "
                        f"declared range in {cite['path']} "
                        f"(now line {anchor_line}, declared {lines})"
                    )

for w in warnings: print(f"::warning::{w}")
for e in errors:   print(f"::error::{e}")
sys.exit(1 if errors else 0)
```

### What it checks

1. **File exists** at `path` (relative to repo root).
2. **Anchor string** appears literally in the file (case-sensitive, substring match — no regex to keep authoring trivial).
3. **Optional line range** still contains the anchor (warning, not error).

### What it does NOT check

- Whether the spec prose accurately describes the cited code (still requires human review).
- Whether all behavior in the code is covered by *some* spec (no reverse-direction check).
- Multi-line code shape (anchor is a single line marker, not an AST query).

### Reporting

- Uses GitHub Actions `::error::`/`::warning::` workflow commands so failures surface inline on the Files-changed view of the PR.
- Exit code 1 on any hard error (missing file or missing anchor); warnings don't fail the job.

### When to run

Run it as a **PR check**, gated on changes in `specs/**` *or* in any `path` referenced by a spec's frontmatter. To keep it cheap we run it unconditionally — the script is O(spec-files × citations) and finishes in <1 second on this repo.

```yaml
# .github/workflows/CI.yml — new job
spec-citations:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with: { python-version: '3.12' }
    - run: pip install pyyaml
    - run: python scripts/check_spec_citations.py
```

No scheduled run needed; PR coverage is sufficient because drift is introduced by PRs.

---

## 4. Migration Path

We don't need to backfill all 19 specs at once. The script is opt-in: specs without an `implements:` frontmatter block are silently skipped.

**Phased rollout:**

1. **PR 1 — tooling only.** Add `scripts/check_spec_citations.py` and the CI job. Ship with zero specs adopted. Job is green because nothing opts in.
2. **PR 2 — pilot on the 4 "canonical" specs** named in `AGENTS.md` (`protocol.md`, `activity-schema.md`, `inbound-auth.md`, `outbound-auth.md`). These are the highest-value to catch drift on. ~5–8 citations each.
3. **PRs 3–N — opportunistic backfill.** Every time someone touches a spec for any reason, they add the frontmatter. No mass-migration PR. Eventually all specs are covered, or the long tail is acknowledged as low-value.
4. **Step-up gate (deferred).** Once ~15/19 are adopted and the false-positive rate is known, decide whether to *require* `implements:` for new specs in `specs/` (excluding `specs/future/`, which describes unbuilt work).

This avoids a giant bookkeeping PR that would itself drift before merging.

---

## 5. Tradeoffs

### What this catches
- **File renames/moves** — anchor lookup fails immediately (`samples.md` regression in #335 would have fired).
- **Symbol renames** — `public class CoreActivity` → `public sealed class CoreActivityV2` fails.
- **File deletions** — missing-file error (the bogus `.NET TokenManager.cs` from #338 would have fired the day someone added the citation, or — if it never existed — never been added in the first place).

### What it misses
- **Semantic drift** — spec says "JWT validated *before* middleware runs"; code reorders to validate *after*. Anchor still resolves; spec is now a lie. No automated tool will catch this without a real test suite.
- **Behavioral parity gaps** — spec lists three languages, only two are cited. Catchable as a future enhancement (require all three keys under `implements:`), but not in v1.
- **Stale prose around a still-valid anchor** — the cited symbol exists but its signature changed. Partial coverage with anchor patterns like `"async processActivity(activity: CoreActivity)"`, but at the cost of brittleness.

### Maintenance burden
- **For spec authors:** add ~3–10 lines of YAML once per spec. Update on rename. Estimated cost: minutes per spec.
- **For code authors:** when renaming a public type, the CI fails on any spec that cited the old name. This is the *desired* behavior — it forces the spec update into the renaming PR. Cost: one extra grep-and-edit.
- **False-positive risk:** low for anchor matching (we expect one false positive per ~10 PRs in steady state — anchor strings that intentionally moved). High for line ranges, which is why they're warning-only.
- **Anchor shadowing:** if the same string appears in two files, an anchor could pass for the wrong reason. Mitigation: keep anchors specific (full signature line, not bare class name when possible). Not worth solving in v1.

### Anchor patterns vs line ranges
Anchor patterns win for refactor resilience. Line ranges win for "this spec describes lines 60–130 specifically." We support both with anchors required and lines optional/warning-only — the common case is cheap, the precise case is possible.

### Honest cost/benefit
- **Build cost:** half a day (script + CI wiring + first 4 spec frontmatters).
- **Ongoing cost:** ~5 min per spec edit, ~1 PR per quarter to update anchors after refactors.
- **Benefit:** would have caught the cited-but-nonexistent file in #338, the renamed sample dirs in #335 / #334, and the wrong Python module name in #338. That's 3 of the last ~5 spec-fix PRs.

I think it's worth building. The cost is real but bounded, and the failure mode it prevents (silent drift) is exactly the one we keep paying for.

---

## 6. Open Questions

1. **Should `implements:` be required for new specs?** Strict answer makes PR review easier but raises the bar for quick design notes. *My lean: no — keep opt-in indefinitely; rely on reviewers to ask "any citations?" during normal review.*
2. **Block PRs or warn?** Errors block; warnings annotate. Pure-warning mode is ignored within a sprint based on past experience with lint warnings in this repo. *My lean: block on errors, warn on line-range drift.*
3. **Citation granularity:** one block per spec (proposed) vs. one per H2 section vs. one per claim? Per-spec is the only one with realistic maintenance cost. *My lean: per-spec.*
4. **Where do `specs/future/` and `specs/reference/` fit?** `future/` describes unbuilt work — citations would always be missing. `reference/` is per-language API surface — heavily citation-worthy. *Suggest: skip `future/`, prioritize `reference/` after the 4 canonical specs.*
5. **Does this replace any existing process?** The `grep` checklist in `AGENTS.md` becomes redundant for paths in citations — drop it from the checklist or keep as belt-and-braces?
6. **Multi-language enforcement:** require all 3 language keys to be present under `implements:` (forcing parity discipline)? Costly for specs that genuinely apply to one language only (e.g., `specs/reference/dotnet.md`). *My lean: don't enforce in v1; revisit.*

---

## 7. Recommendation

**Build it, in three small PRs.**

| PR | Scope | Risk |
|---|---|---|
| 1 | `scripts/check_spec_citations.py` + CI job, no spec changes | Trivial — green on all current specs because none opt in. |
| 2 | Add `implements:` frontmatter to `protocol.md`, `activity-schema.md`, `inbound-auth.md`, `outbound-auth.md` | Pilot — exposes any anchor-matching weirdness on the 4 most-cited specs. |
| 3 | Documentation: short section in `AGENTS.md` ("Spec citations") + example in one decision doc | Pure docs. |

**Defer:**
- Reverse-direction check (code → spec coverage).
- Multi-language requirement.
- Mandatory adoption gate.

**Skip entirely:**
- Line-number-precise citations.
- AST-based anchor matching.
- Any spec-DSL beyond "path + anchor string."

If the pilot (PR 2) shows >2 false-positive errors in the first 5 PRs that touch cited code, reduce to warnings and rethink. Otherwise, expand opportunistically per Section 4.

---

## Appendix: Worked example

Spec drift caught by #338, in counterfactual form:

`specs/outbound-auth.md` (pre-#338) had this frontmatter:

```yaml
---
implements:
  dotnet:
    - path: dotnet/src/Botas/TokenManager.cs
      anchor: "public class TokenManager"
---
```

On the next CI run after the .NET refactor that consolidated token management into `BotAuthenticationHandler.cs`:

```
::error::specs/outbound-auth.md: missing file dotnet/src/Botas/TokenManager.cs
```

The spec author updates the citation in the same PR as the refactor:

```yaml
  dotnet:
    - path: dotnet/src/Botas/BotAuthenticationHandler.cs
      anchor: "class BotAuthenticationHandler"
```

…and the prose nearby ("the .NET `TokenManager` caches tokens with…") becomes obviously wrong on diff review, prompting a prose fix. That is the entire intended workflow.
