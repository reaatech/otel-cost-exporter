# Skill: npm & pnpm Workflows

<!--
  Implementation Status: ACTIVE
  Target Phase: 0 (Project Scaffolding)
-->

## Overview

This skill covers npm/pnpm package management workflows for the otel-cost-exporter project, including dependency management, publishing, and lockfile handling.

## Package Manager

This project uses **pnpm** (v10+) as the package manager. The `packageManager` field in `package.json` enforces this.

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
corepack prepare pnpm@10 --activate

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
pnpm audit --audit-level=high
```

### Handling Audit Findings

1. **Patch available**: Run `pnpm audit --fix` to apply automated patches
2. **No fix available**: Assess severity, consider dependency replacement
3. **False positive**: Document in security-review.md and add exception
4. **Critical CVE**: Bump or replace dependency immediately, create incident issue

## Publishing Workflow

This project uses **changesets** for versioning and publishing.

```
1. pnpm changeset          # interactive: pick packages, bump type, summary
2. Commit and push         # CI opens/updates "Version Packages" PR
3. Review version bumps and CHANGELOGs
4. Merge Version Packages PR  → CI publishes to npm + mirrors to GitHub Packages
```

### Pre-publish Checklist

- [ ] All tests passing (`pnpm test`)
- [ ] Coverage >= 85% (`pnpm test:coverage`)
- [ ] TypeScript compiles clean (`pnpm typecheck`)
- [ ] Linting passes (`pnpm lint`)
- [ ] CHANGELOG.md updated (changesets handles this automatically)

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

## Monorepo-Specific Notes

### Workspace Protocol

Internal package dependencies use the `workspace:*` protocol:

```json
{
  "dependencies": {
    "@reaatech/otel-cost-exporter-core": "workspace:*"
  }
}
```

This ensures intra-repo packages always resolve to the local version. pnpm replaces `workspace:*` with the actual version at publish time.

### Root-Level Operations

```bash
# Install all workspace dependencies (run from repo root)
pnpm install -w

# Add a dependency to the root workspace
pnpm add -w <package>

# Run a command across all workspace packages
pnpm -r run test
pnpm -r run build

# Run a command for a specific package
pnpm --filter @reaatech/otel-cost-exporter-core run test
```
