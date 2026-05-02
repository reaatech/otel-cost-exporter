# Skill: Release and Deployment Procedures

<!--
  Implementation Status: PLANNING
  Target Phase: 4 (Production Readiness)
  Prerequisites: Phase 1-3 (Foundation, Core, Integration)
  Note: This monorepo uses Changesets for version management and publishing.
        Docker builds, Kubernetes manifests, and npm publish are Phase 4 deliverables.
-->

## Overview

This skill provides comprehensive procedures for releasing and deploying the otel-cost-exporter monorepo. Version management uses [Changesets](https://github.com/changesets/changesets) with automatic changelog generation and multi-package publishing to npm and GitHub Packages. CI/CD workflows handle the "Version Packages" PR and publishing on merge to main.

## Monorepo Packages

| Package | npm Name | Path |
|---------|----------|------|
| Core | `@reaatech/otel-cost-exporter-core` | `packages/core/` |
| Pricing | `@reaatech/otel-cost-exporter-pricing` | `packages/pricing/` |
| Calculator | `@reaatech/otel-cost-exporter-calculator` | `packages/calculator/` |
| Exporter | `@reaatech/otel-cost-exporter` | `packages/exporter/` |
| CLI | `@reaatech/otel-cost-exporter-cli` | `packages/cli/` |

## Release Types

| Type | Changeset | When to Use |
|------|-----------|-------------|
| Patch | `pnpm changeset` → select patch | Bug fixes, pricing updates, documentation |
| Minor | `pnpm changeset` → select minor | New features, new models, backward compatible changes |
| Major | `pnpm changeset` → select major | Breaking changes, major refactoring |

## Pre-Release Checklist

Before recording a changeset, ensure:

- [ ] All tests passing: `pnpm test`
- [ ] Code coverage >= 85%: `pnpm test:coverage`
- [ ] No linting errors: `pnpm lint`
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Documentation updated (CHANGELOG handled automatically by Changesets)
- [ ] Security scan passed: `pnpm audit --audit-level=high`

## Release Procedure (Changesets)

### Step 1: Record Changes

After making changes to one or more packages, record a changeset:

```bash
# Create a changeset interactively
pnpm changeset
```

- Select the packages that changed (use arrow keys + space to select)
- Choose the version bump: patch, minor, or major
- Write a summary of the changes (appears in each package's CHANGELOG.md)

This creates a Markdown file in `.changeset/` with a unique name like `chilly-cats-yawn.md`.

```markdown
---
'@reaatech/otel-cost-exporter-pricing': patch
'@reaatech/otel-cost-exporter-exporter': patch
---

Updated OpenAI GPT-4o pricing to reflect latest rate changes.
```

Commit the changeset alongside your code changes:

```bash
git add .changeset/ packages/
git commit -m "pricing: update OpenAI GPT-4o rates"
```

### Step 2: Push and Open PR

Push your branch to GitHub and open a pull request against `main`. The changeset file travels with the code. CI runs tests, linting, and typechecking automatically.

### Step 3: CI Opens "Version Packages" PR

When your PR is merged to `main`, the Changesets GitHub Action (`.github/workflows/release.yaml`) runs:

1. Detects any `.changeset/*.md` files on `main`
2. Opens (or updates) a **"Version Packages" PR** that:
   - Consumes all changesets
   - Bumps package versions according to each changeset
   - Updates `CHANGELOG.md` files in each changed package
   - Updates inter-package `workspace:*` dependency ranges

### Step 4: Review and Merge "Version Packages" PR

Review the auto-generated "Version Packages" PR:
- Verify version bumps are correct
- Review generated changelog entries
- Once approved, merge the PR

### Step 5: Auto-Publish to npm + GitHub Packages

Merging the "Version Packages" PR triggers the publish workflow:

```yaml
# .github/workflows/release.yaml (publish step)
name: Release

on:
  push:
    branches:
      - main

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.node-version'
          registry-url: 'https://registry.npmjs.org'

      - name: Set up pnpm
        uses: pnpm/action-setup@v3
        with:
          version: latest

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build all packages
        run: pnpm build

      - name: Run tests
        run: pnpm test

      - name: Publish to npm
        run: pnpm release
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Build Docker image
        run: docker build -f docker/Dockerfile -t ghcr.io/reaatech/otel-cost-exporter:latest .

      - name: Push Docker image
        run: docker push ghcr.io/reaatech/otel-cost-exporter:latest
```

### Step 6: Verify Release

```bash
# Check all published packages
npm view @reaatech/otel-cost-exporter versions
npm view @reaatech/otel-cost-exporter-core versions
npm view @reaatech/otel-cost-exporter-pricing versions
npm view @reaatech/otel-cost-exporter-calculator versions
npm view @reaatech/otel-cost-exporter-cli versions

# Install specific packages
pnpm add @reaatech/otel-cost-exporter@latest

# Verify Docker image
docker pull ghcr.io/reaatech/otel-cost-exporter:latest
docker run --rm ghcr.io/reaatech/otel-cost-exporter:latest --version
```

## Deployment Procedures

### Kubernetes Deployment

```yaml
# deployments/kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-cost-exporter
  labels:
    app: otel-cost-exporter
spec:
  replicas: 2
  selector:
    matchLabels:
      app: otel-cost-exporter
  template:
    metadata:
      labels:
        app: otel-cost-exporter
    spec:
      containers:
      - name: otel-cost-exporter
        image: ghcr.io/reaatech/otel-cost-exporter:latest
        args:
          - "serve"
          - "--config=/etc/otel-cost-exporter/config.yaml"
        ports:
        - containerPort: 8888
          name: metrics
        - containerPort: 8889
          name: health
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: health
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: health
          initialDelaySeconds: 5
          periodSeconds: 5
```

```bash
# Deploy
kubectl apply -f deployments/kubernetes/

# Check status
kubectl rollout status deployment/otel-cost-exporter

# Verify pods
kubectl get pods -l app=otel-cost-exporter

# Check logs
kubectl logs -l app=otel-cost-exporter --tail=50
```

### Docker Deployment

```bash
# Build multi-arch image
docker build -f docker/Dockerfile -t otel-cost-exporter:latest .

# Run with Docker
docker run -d \
  --name otel-cost-exporter \
  -p 8888:8888 \
  -v /path/to/config.yaml:/etc/otel-cost-exporter/config.yaml \
  ghcr.io/reaatech/otel-cost-exporter:latest

# Run with Docker Compose
docker-compose up -d otel-cost-exporter
```

### OpenTelemetry Collector Deployment

```yaml
# otel-collector-config.yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 10s
  cost_exporter:
    pricing:
      auto_update: true
      update_interval: 24h
    metrics:
      prefix: "llm_cost"
      labels:
        environment: production
    export:
      format: prometheus

exporters:
  prometheus:
    endpoint: 0.0.0.0:8888
    namespace: otel

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch, cost_exporter]
      exporters: [prometheus]
```

## Post-Release Verification

### Health Checks

```bash
# Check health endpoint
curl http://localhost:8888/health
# Expected: {"status":"healthy"}

# Check readiness endpoint
curl http://localhost:8888/ready
# Expected: {"status":"ready"}

# Check metrics endpoint
curl http://localhost:8888/metrics
# Expected: Prometheus metrics output
```

### Functional Verification

```bash
# Check supported models
curl http://localhost:8888/debug/models
# Expected: List of supported models
```

### Monitoring Verification

```bash
# Check internal metrics
curl http://localhost:8888/metrics | grep otel_cost_exporter

# Expected metrics:
# otel_cost_exporter_health{status="healthy"} 1
# otel_cost_exporter_spans_processed_total 0
```

## Rollback Procedure

### npm Package Rollback

If a published package version has a critical bug:

```bash
# Deprecate the bad version
npm deprecate @reaatech/otel-cost-exporter@1.2.0 "Critical bug - use 1.1.0"

# Repoint latest tag to the previous stable version
npm dist-tag add @reaatech/otel-cost-exporter@1.1.0 latest

# Do this for each affected package
npm deprecate @reaatech/otel-cost-exporter-core@1.2.0 "Critical bug - use 1.1.0"
npm dist-tag add @reaatech/otel-cost-exporter-core@1.1.0 latest
```

### Kubernetes Rollback

```bash
# Rollback to previous deployment revision
kubectl rollout undo deployment/otel-cost-exporter

# Or rollback to specific revision
kubectl rollout undo deployment/otel-cost-exporter --to-revision=2

# Verify rollback
kubectl rollout status deployment/otel-cost-exporter
```

### Emergency Rollback

```bash
# Stop all instances
kubectl scale deployment otel-cost-exporter --replicas=0

# Deploy previous stable version
kubectl set image deployment/otel-cost-exporter \
  otel-cost-exporter=ghcr.io/reaatech/otel-cost-exporter:<previous-tag>

# Scale back up
kubectl scale deployment otel-cost-exporter --replicas=2

# Monitor closely
kubectl logs -f -l app=otel-cost-exporter
```

## Hotfix Procedure

1. **Create hotfix branch from main**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b hotfix/critical-fix
   ```

2. **Apply fix and record a changeset**
   ```bash
   # Make changes to package source
   # ...

   # Record a patch changeset
   pnpm changeset
   # Select the affected package(s), choose "patch"

   # Run tests
   pnpm test
   pnpm typecheck

   # Commit
   git add .
   git commit -m "fix: critical bug fix"
   ```

3. **Open PR to main**

   Push the branch and open a PR. After merge, the changeset workflow will create the "Version Packages" PR with the hotfix bump. Merge that PR to trigger the publish.

## Best Practices

1. **Always record changesets** — Every user-facing change should have one
2. **Keep changesets small** — One changeset per logical change, not one giant changeset
3. **Test thoroughly** — Run full test suite before opening PRs
4. **Use CI/CD** — Let the automated workflow handle versioning and publishing
5. **Monitor after release** — Watch for errors and performance issues
6. **Have rollback plan** — Be prepared to rollback quickly via npm dist-tags
7. **Communicate changes** — Changesets become changelog entries automatically
8. **Security first** — Scan for vulnerabilities before release

## Release Schedule

| Release Type | Frequency | Process |
|--------------|-----------|---------|
| Patch | As needed | Record changeset → merge → auto-publish |
| Minor | Monthly | Full release process with changeset review |
| Major | Quarterly | Extended testing period with changeset planning |

## Version Support Policy

Each package in the monorepo is independently versioned. Breaking changes in one package do not force a major bump in others unless the public API is affected. Workspace dependencies are kept in sync via `workspace:*`.

| Version Line | Support Status | End of Life |
|-------------|----------------|-------------|
| Latest | Current | - |
| Previous minor | Maintenance | 3 months after next minor |
| Older versions | End of Life | 3 months after subsequent release |
