# Release Process

## Overview

The `botas` project uses [Nerdbank.GitVersioning (nbgv)](https://github.com/dotnet/Nerdbank.GitVersioning) for deterministic versioning across all three language implementations (.NET, Node.js, Python). Release branches trigger automated publishing to public package registries, while pre-release packages can be published on-demand from main via workflow dispatch.

## Versioning

### How It Works

Version configuration lives in [`version.json`](../version.json) at the repository root:

```json
{
  "version": "0.3-alpha",
  "publicReleaseRefSpec": [
    "^refs/heads/release/.*$",
    "^refs/tags/v.*$"
  ],
  "cloudBuild": { "buildNumber": { "enabled": true } }
}
```

**Key fields:**
- **`version`**: Base version string (e.g., `0.3-alpha`)
- **`publicReleaseRefSpec`**: Regex patterns defining which refs produce stable releases (`release/*` branches and `v*` tags)
- **`cloudBuild.buildNumber.enabled`**: Enables version height stamping for non-release builds

### Version Computation

| Branch Type | Example Version | Pattern |
|------------|-----------------|---------|
| Release branch (`release/*`) | `0.3.0` | Stable semantic version from `version.json` |
| Main branch | `0.3.0-alpha.123` (.NET), `0.3.0-dev.123` (Node), `0.3.0.dev123` (Python) | Base version + pre-release suffix + version height |

**Version height** is the number of commits since the last version change in `version.json`. It auto-increments with each commit.

### Language-Specific Version Stamping

Each language uses nbgv differently:

| Language | Tool | Command |
|----------|------|---------|
| .NET | Native MSBuild integration | Automatic during build (nbgv MSBuild SDK) |
| Node.js | `nbgv-setversion` npm package | `npx nbgv-setversion` (writes to `package.json`) |
| Python | nbgv CLI | `nbgv get-version -v SimpleVersion` (writes to `src/botas/_version.py`) |

## Package Registries

Published packages follow a two-tier model: stable releases go to public registries, while pre-release packages go to testing/private feeds.

| Language | Stable (release branch) | Non-stable (main branch) |
|----------|------------------------|--------------------------|
| **[.NET](https://www.nuget.org/packages/Botas)** | [NuGet.org](https://www.nuget.org/packages/Botas) | [GitHub Packages](https://github.com/rido-min/botas/packages) (nuget.pkg.github.com) |
| **[Node.js](https://www.npmjs.com/package/botas-core)** | [npm](https://www.npmjs.com/package/botas-core) (latest tag) | [GitHub Packages](https://github.com/rido-min/botas/packages) (npm.pkg.github.com) |
| **[Python](https://pypi.org/project/botas/)** | [PyPI](https://pypi.org/project/botas/) | [TestPyPI](https://test.pypi.org/project/botas/) |

**Node.js note:** Non-stable packages are published to GitHub npm registry (npm.pkg.github.com) starting with version 0.3-alpha, not to public npm.

## Release Process

There are two ways to create a stable release: **branch-based** and **tag-based**. Both trigger the same CD pipeline and publish to the same registries.

### Prerequisites

1. All tests passing on main
2. Version bumped in `version.json` (if starting a new release cycle)
3. Write access to the repository
4. Package registry credentials configured (handled by GitHub Actions secrets)

### Option A: Branch-Based Release

Use this when you want a long-lived release branch that can receive hotfixes.

**1. Create a release branch**

Release branches must follow the `release/*` naming pattern to match the `publicReleaseRefSpec` in `version.json`.

```bash
# Example: releasing version 0.3.0
git checkout main
git pull origin main
git checkout -b release/0.3
```

**Branch naming convention:** `release/{major}.{minor}` (e.g., `release/0.3`, `release/1.0`)

**2. Push the release branch**

```bash
git push origin release/0.3
```

### Option B: Tag-Based Release

Use this for a quick release from any commit (typically on `main`).

**1. Create and push a version tag**

```bash
git checkout main
git pull origin main
git tag v0.3.0
git push origin v0.3.0
```

**Tag naming convention:** `v{major}.{minor}.{patch}` (e.g., `v0.3.0`, `v1.0.0`). The tag must start with `v` to match the CD trigger and `publicReleaseRefSpec`.

### Monitoring and Verification

Both options trigger the [CD workflow](../.github/workflows/CD.yml) in release mode.

**3. Monitor the CD workflow**

Visit the [Actions tab](https://github.com/rido-min/botas/actions/workflows/CD.yml) and watch the triggered workflow:

- **Changes job**: Forces all three languages to build (release branches skip path filtering)
- **dotnet job**: Builds, tests, and publishes to NuGet.org
- **node job**: Builds, tests, and publishes to npm (both `botas-core` and `botas-express` packages)
- **python job**: Builds, tests, and publishes to PyPI (both `botas` and `botas-fastapi` packages)
- **release job**: Creates a GitHub Release with auto-generated notes (only runs if all 3 language jobs succeed)

Expected runtime: ~5-10 minutes for all jobs to complete.

**4. Verify the GitHub Release**

Once the `release` job completes, a new [GitHub Release](https://github.com/rido-min/botas/releases) is created automatically:

- **Tag:** `v{version}` (e.g., `v0.3.0`)
- **Title:** Same as tag
- **Notes:** Auto-generated from commits since the last release

The release notes will include:
- Pull requests merged since the last tag
- Commit history grouped by contributor
- Link to full changelog

**5. Verify published packages**

Check each package registry to confirm publication:

| Registry | Verification Link |
|----------|-------------------|
| NuGet.org | `https://www.nuget.org/packages/Botas/{version}` |
| npm (botas-core) | `https://www.npmjs.com/package/botas-core/v/{version}` |
| npm (botas-express) | `https://www.npmjs.com/package/botas-express/v/{version}` |
| PyPI (botas) | `https://pypi.org/project/botas/{version}/` |
| PyPI (botas-fastapi) | `https://pypi.org/project/botas-fastapi/{version}/` |

Installation commands (stable):
```bash
# .NET
dotnet add package Botas --version {version}

# Node.js
npm install botas-core@{version} botas-express@{version}

# Python
pip install botas=={version} botas-fastapi=={version}
```

## Non-Stable Releases

Pre-release packages can be published on-demand from the `main` branch using workflow dispatch. They are **not** published automatically on every push to `main`.

### How to Publish Pre-Release Packages

1. Go to the [CD workflow](https://github.com/rido-min/botas/actions/workflows/CD.yml) in the **Actions** tab.
2. Click **"Run workflow"**.
3. Select the `main` branch (or any non-release branch).
4. Click the green **"Run workflow"** button.

Alternatively, use the GitHub CLI:

```bash
gh workflow run CD.yml --ref main
```

### Behavior

- **Trigger:** Manual workflow dispatch from the Actions tab or `gh workflow run`
- **Path filtering:** Only languages with changes are built (unless path is `version.json`, which affects all)
- **Version format:** See "Version Computation" table above

### Where Non-Stable Packages Go

| Language | Registry | Notes |
|----------|----------|-------|
| .NET | GitHub Packages (nuget.pkg.github.com) | Requires GitHub authentication |
| Node.js | GitHub Packages (npm.pkg.github.com) | Requires GitHub authentication + `.npmrc` config |
| Python | TestPyPI (test.pypi.org) | Public test feed; no authentication required to download |

### Installing Non-Stable Packages

**Node.js from GitHub Packages:**
```bash
# Add to .npmrc in your project root:
@rido-min:registry=https://npm.pkg.github.com

# Install with dev tag:
npm install @rido-min/botas@dev
```

**.NET from GitHub Packages:**
```bash
# Add source (one-time):
dotnet nuget add source https://nuget.pkg.github.com/rido-min/index.json -n github -u YOUR_GITHUB_USERNAME -p YOUR_PAT

# Install pre-release package:
dotnet add package Botas --prerelease
```

**Python from TestPyPI:**
```bash
# Install directly (with --index-url):
pip install --index-url https://test.pypi.org/simple/ --extra-index-url https://pypi.org/simple botas

# Or add to requirements.txt:
--index-url https://test.pypi.org/simple/
--extra-index-url https://pypi.org/simple/
botas
```

**Note:** Non-stable packages are for testing only. Do not use in production.

## Version Bumping

After a release is published, bump the version in `version.json` to start the next release cycle.

### When to Bump

- Immediately after a stable release is published (to start next cycle)
- Before merging a PR if it introduces breaking changes that warrant a major/minor version bump

### How to Bump

Edit [`version.json`](../version.json):

```json
{
  "version": "0.4-alpha",  // Increment from 0.3-alpha
  "publicReleaseRefSpec": ["^refs/heads/release/.*$"],
  "cloudBuild": { "buildNumber": { "enabled": true } }
}
```

Commit directly to `main` or include in a PR:

```bash
git add version.json
git commit -m "Bump version to 0.4-alpha for next release cycle"
git push origin main
```

Version height resets to `0` after this commit.

### Version Bump Strategies

| Change Type | Example Bump | Reasoning |
|-------------|-------------|-----------|
| Patch fixes only | `0.3-alpha` → `0.3-alpha` | Keep same version; patch increments happen at release time |
| New features, non-breaking | `0.3-alpha` → `0.4-alpha` | Minor version bump |
| Breaking changes | `0.9-alpha` → `1.0-beta` | Major version bump; optionally change pre-release label |

## Troubleshooting

### Release job didn't create a GitHub Release

**Cause:** One or more language jobs failed.

**Fix:** Check the failed job logs in the workflow. Common issues:
- Test failures (fix tests and re-push to the release branch)
- Package registry authentication errors (check GitHub secrets: `NUGET_API_KEY`, `NPM_TOKEN`, `PYPI_API_TOKEN`)

### Package published with wrong version

**Cause:** `version.json` not committed before creating the release branch.

**Fix:**
1. Delete the release branch
2. Delete the incorrect GitHub Release and tag
3. Update `version.json` on main
4. Recreate the release branch

### Non-stable package not published

**Cause:** Path filtering skipped the language (no changes detected), or the workflow was not manually triggered.

**Fix:** If path filtering skipped a language, push a change to `version.json` and re-run. To publish pre-release packages, trigger the CD workflow manually from the [Actions tab](https://github.com/rido-min/botas/actions/workflows/CD.yml) or with `gh workflow run CD.yml --ref main`.

## References

- [`version.json`](../version.json) — version configuration
- [`.github/workflows/CD.yml`](../.github/workflows/CD.yml) — continuous deployment workflow
- [Nerdbank.GitVersioning documentation](https://github.com/dotnet/Nerdbank.GitVersioning/blob/main/doc/index.md)
- [GitHub Packages: npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
- [GitHub Packages: NuGet registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-nuget-registry)
