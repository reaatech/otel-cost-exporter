# Skill: npm & pnpm Workflows

<!--
  Implementation Status: ACTIVE
  Target Phase: 0 (Project Scaffolding)
-->

## Overview

This skill covers npm/pnpm package management workflows for the otel-cost-exporter project, including dependency management, publishing, and lockfile handling.

## Package Manager

This project uses **pnpm** (v9+) as the package manager. The `packageManager` field in `package.json` enforces this.

### Why pnpm

- Strict dependency resolution (no phantom dependencies)
- Disk-efficient with content-addressable storage
- Fast installs via hard links
- Monorepo-ready for future expansion

## Common Tasks

### Installing Dependencies

```bash
# First-time setup
corepack enable
corepack prepare pnpm@9 --activate

# Install from lockfile (CI-safe)
pnpm install --frozen-lockfile

# Install and update lockfile
pnpm install

# Add a dependency
pnpm add <package>
pnpm add -D <package>  # dev dependency

# Remove a dependency
pnpm remove <package>
```

### Managing the Lockfile

```bash
# Regenerate lockfile after conflicts
rm pnpm-lock.yaml
pnpm install

# Verify lockfile is up to date
pnpm install --frozen-lockfile
```

### Updating Dependencies

```bash
# Check for outdated packages
pnpm outdated

# Update all to latest (within semver ranges)
pnpm update

# Update to latest (including breaking)
pnpm update --latest

# Update a specific package
pnpm update <package> --latest

# Security audit
pnpm audit
pnpm audit --audit-level=high

# Fix vulnerabilities
pnpm audit --fix
```

## Security Scanning

```bash
# Full audit
pnpm audit

# Only high/critical issues
pnpm audit --audit-level=high

# Check before commit
make security-scan  # runs: pnpm audit --audit-level=high
```

### Handling Audit Findings

1. **Patch available**: Run `pnpm audit --fix` to apply automated patches
2. **No fix available**: Assess severity, consider dependency replacement
3. **False positive**: Document in security-review.md and add exception
4. **Critical CVE**: Bump or replace dependency immediately, create incident issue

## Publishing Workflow

### npm Registry

```bash
# Dry-run publish (check what would be published)
pnpm publish --dry-run

# Publish to npm (CI-only; use secrets.NPM_TOKEN)
pnpm publish --access public --no-git-checks
```

### GitHub Packages (ghcr.io)

The Docker image is published alongside the npm package via `release.yaml`.

### Pre-publish Checklist

- [ ] All tests passing (`make test`)
- [ ] Coverage >= 85% (`make test-coverage`)
- [ ] TypeScript compiles clean (`make typecheck`)
- [ ] Linting passes (`make lint`)
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json
- [ ] Tag pushed (`git tag v<version>`)

### Version Bumping

```bash
# Patch (0.1.0 → 0.1.1)
pnpm bump-patch  # runs: npm version patch --no-git-tag-version
pnpm version patch

# Minor (0.1.0 → 0.2.0)
pnpm version minor

# Major (0.1.0 → 1.0.0)
pnpm version major
```

### Creating a Release Tag

```bash
# Read current version
VERSION=$(node -p "require('./package.json').version")

# Create annotated tag
git tag -a "v$VERSION" -m "Release v$VERSION"

# Push tag (triggers release workflow)
git push origin "v$VERSION"
```

## Lockfile Conflicts

When `pnpm-lock.yaml` has merge conflicts:

```bash
# 1. Accept your branch's lockfile
git checkout --ours pnpm-lock.yaml

# 2. Regenerate from resolved package.json
pnpm install

# 3. Stage the regenerated lockfile
git add pnpm-lock.yaml
```

## Dependency Best Practices

1. **Pin exact versions for dependencies** — Remove `^` and `~` prefixes for runtime deps
2. **Allow patch ranges for dev deps** — `~` is acceptable for tooling
3. **Group OTel packages** — All `@opentelemetry/*` should use the same version
4. **Audit before every release** — Run `pnpm audit --audit-level=high`
5. **Review dep size impact** — Use [bundlephobia](https://bundlephobia.com) for new deps
6. **Prefer ESM** — All packages should support ESM imports
7. **No transitive dep overrides** — Keep `overrides` minimal, document any
