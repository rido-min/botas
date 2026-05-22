---
skill: cd-package-extension
owner: Bender
created: 2026-05-08
---

# Extending CD Pipeline for New Packages

## When to use

Adding a new publishable package to the monorepo (dotnet, node, or python) and wiring it into the CD.yml pipeline.

## Checklist

### .NET packages

1. **Solution file**: Confirm the new `.csproj` is in `Botas.slnx` (CI/CD build steps must compile it).
2. **CD.yml dotnet job**: Add a `Pack <PackageName>` step after existing Pack steps:
   ```yaml
   - name: Pack MyPackage
     run: dotnet pack src/MyPackage/MyPackage.csproj --no-build -c Release -o ./nupkg
   ```
3. **No publish step needed**: Existing `dotnet nuget push ./nupkg/*.nupkg` uses wildcard; picks up all packages.
4. **Release notes**: Update `release` job's package table to list the new NuGet package.
5. **RELEASING.md**: Add install command and verification link.

### Node.js packages

1. **Workspace structure**: New package must be in `node/packages/<name>/` with valid `package.json`.
2. **CD.yml node job**: Add nbgv-setversion + npm publish steps (mirror botas-express):
   ```yaml
   - name: Set <package-name> package version
     run: npx nbgv-setversion
     working-directory: node/packages/<package-name>

   - name: Publish <package-name> to npm
     run: npm publish --workspace packages/<package-name> --access public --tag ${{ needs.changes.outputs.is_release == 'true' && 'latest' || 'dev' }}
     env:
       NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
   ```
3. **Order matters**: nbgv-setversion MUST run before npm publish.
4. **Release notes**: Update package table.
5. **RELEASING.md**: Add install command and verification link.
6. **Docs**: If API docs are generated, add TypeDoc config (`typedoc.json`) and wire into `docs-site/generate-api-docs.sh`.
7. **JSR**: If the package should ship to JSR, update `jsr-publish.yml`. Document if intentionally skipped.

### Python packages

1. **Separate package vs extra**: Decide if the feature should be a new PyPI package or an optional extra in the existing `botas` package. Extras are simpler for optional dependencies (e.g., `botas[redis]`).
2. **If new package**: Add a new job in CD.yml (mirror `python-fastapi`). Depends on `python` job, pins exact botas version with `sed -i` before build.
3. **If extra**: Add to `[project.optional-dependencies]` in `pyproject.toml`. No CD change needed.
4. **Release notes**: Update package table or document the extra.
5. **RELEASING.md**: Add install command.

### Common steps (all languages)

1. **Path filtering**: Existing filters (`dotnet/**`, `node/**`, `python/**`) usually cover new packages. Verify with a test commit.
2. **Local validation**: Before opening PR, test locally:
   - .NET: `dotnet pack <project> --no-build -c Release`
   - Node: `npx nbgv-setversion && npm pack --dry-run`
   - Python: `python -m build`
3. **CI vs CD gap**: CD.yml doesn't run on PRs. Green CI checks don't validate new CD steps. Plan a post-merge smoke test (workflow_dispatch) before the next real release.
4. **Security**: Ensure no secret leakage, correct token usage, appropriate permissions.

## Example PRs

- PR #366: Added `botas-redis` (Node.js) and `Botas.Redis` (.NET) to CD pipeline.
- (Future: link additional examples here)

## Anti-patterns

- **Forgetting nbgv-setversion**: Node packages must have version set before publish; otherwise they ship with the dev version from package.json.
- **Separate push steps for .NET**: Don't add per-package nuget push steps; use the wildcard pattern (`./nupkg/*.nupkg`).
- **Hardcoding versions**: Use nbgv-driven versioning; never hardcode versions in CD steps.
