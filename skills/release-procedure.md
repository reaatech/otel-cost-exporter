# Skill: Release and Deployment Procedures

<!--
  Implementation Status: PLANNING
  Target Phase: 4 (Production Readiness)
  Prerequisites: Phase 1-3 (Foundation, Core, Integration)
  Note: All pnpm scripts and CI/CD workflows referenced here already exist
        as scaffolding. Docker builds, Helm charts, and npm publish are Phase 4 deliverables.
-->

## Overview

This skill provides comprehensive procedures for releasing and deploying the otel-cost-exporter system. It covers version management, build procedures, deployment steps, and post-release verification.

## Release Types

| Type | Version Bump | When to Use |
|------|--------------|-------------|
| Patch | x.y.z → x.y.z+1 | Bug fixes, pricing updates, documentation |
| Minor | x.y.z → x.y+1.0 | New features, new models, backward compatible changes |
| Major | x+1.0.0 | Breaking changes, major refactoring |

## Pre-Release Checklist

Before creating a release, ensure:

- [ ] All tests passing
- [ ] Code coverage >= 85%
- [ ] No linting errors
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version numbers updated
- [ ] Security scan passed
- [ ] Performance benchmarks run
- [ ] Integration tests passed

## Release Procedure

### Step 1: Prepare Release

1. **Create release branch**
   ```bash
   # Create release branch
   git checkout -b release/v1.2.0 main

   # Or for patch release
   git checkout -b release/v1.1.1 v1.1.0
   ```

2. **Update version numbers**
   ```bash
   # Update version in package.json
   pnpm version patch   # or pnpm version minor, or pnpm version major

   # Update version constant in source
   # Edit src/semconv/version.ts
   export const VERSION = "1.2.0";

   # Update version in Helm chart (Phase 4+)
   # Edit deployments/helm/chart/Chart.yaml
   version: 1.2.0
   appVersion: 1.2.0
   ```

3. **Update CHANGELOG.md**
   ```markdown
   ## [1.2.0] - 2024-01-15

   ### Added
   - Support for Claude 3 models
   - New pricing table for Google Gemini
   - OTLP metrics export support

   ### Changed
   - Improved caching performance
   - Updated OpenAI pricing

   ### Fixed
   - Fixed model normalization for fine-tuned models
   - Fixed memory leak in export buffer

   ### Security
   - Updated dependencies with security vulnerabilities
   ```

4. **Commit changes**
   ```bash
   git add src/semconv/version.ts package.json CHANGELOG.md
   git add deployments/helm/chart/Chart.yaml  # Phase 4+

   git commit -m "chore: prepare release v1.2.0"
   ```

### Step 2: Run Pre-Release Tests

```bash
# Run full test suite
pnpm test

# Run performance benchmarks
pnpm vitest bench

# Run security audit
pnpm audit --audit-level=high

# Build the project
pnpm build

# Test Docker build (Phase 4+)
docker build -t ghcr.io/reaatech/otel-cost-exporter:v1.2.0 .

# Validate Helm chart (Phase 4+)
helm lint deployments/helm/chart/
```

### Step 3: Create Release

1. **Tag the release**
   ```bash
   # Create annotated tag
   git tag -a v1.2.0 -m "Release v1.2.0"

   # Sign tag (recommended)
   git tag -s v1.2.0 -m "Release v1.2.0"

   # Push tag
   git push origin v1.2.0
   ```

2. **Push release branch**
   ```bash
   git push origin release/v1.2.0

   # Create PR to main
   gh pr create --base main --head release/v1.2.0 \
     --title "Release v1.2.0" \
     --body "This PR releases version 1.2.0"
   ```

3. **Merge and tag**
   ```bash
   # After PR approval
   gh pr merge --squash --delete-branch

   # Tag from main
   git checkout main
   git pull origin main
   git tag -a v1.2.0 -m "Release v1.2.0"
   git push origin v1.2.0
   ```

### Step 4: Automated Release (GitHub Actions)

The push of a version tag triggers the release workflow:

```yaml
# .github/workflows/release.yaml
name: Release

on:
  push:
    tags:
      - 'v*'

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

      - name: Run tests
        run: pnpm test

      - name: Run type-check
        run: pnpm typecheck

      - name: Build
        run: pnpm build

      - name: Publish to npm
        run: pnpm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Build Docker image
        run: docker build -t ghcr.io/reaatech/otel-cost-exporter:${{ github.ref_name }} .

      - name: Push Docker image
        run: docker push ghcr.io/reaatech/otel-cost-exporter:${{ github.ref_name }}

      - name: Create GitHub Release
        run: gh release create ${{ github.ref_name }} \
          --notes-file CHANGELOG.md \
          --title "Release ${{ github.ref_name }}" \
          dist/*

      - name: Publish Helm chart (Phase 4+)
        run: helm package deployments/helm/chart/ && helm push *.tgz oci://ghcr.io/reaatech/helm-charts
```

### Step 5: Verify Release

1. **Check npm package**
   ```bash
   # View package on npm
   npm view otel-cost-exporter versions

   # Install specific version
   pnpm add otel-cost-exporter@1.2.0
   ```

2. **Check GitHub Release**
   ```bash
   # View release
   gh release view v1.2.0

   # Download release assets
   gh release download v1.2.0
   ```

3. **Verify Docker image**
   ```bash
   # Pull image
   docker pull ghcr.io/reaatech/otel-cost-exporter:v1.2.0

   # Run container
   docker run --rm ghcr.io/reaatech/otel-cost-exporter:v1.2.0 --version

   # Expected output: otel-cost-exporter version 1.2.0
   ```

4. **Verify Helm chart (Phase 4+)**
   ```bash
   # Add Helm repository
   helm repo add otel-cost-exporter https://reaatech.github.io/helm-charts

   # Search for chart
   helm search repo otel-cost-exporter

   # Expected output should show v1.2.0
   ```

## Deployment Procedures

### Kubernetes Deployment

#### Standard Deployment

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
        version: v1.2.0
    spec:
      containers:
      - name: otel-cost-exporter
        image: ghcr.io/reaatech/otel-cost-exporter:v1.2.0
        args:
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

#### Deploy with kubectl

```bash
# Apply deployment
kubectl apply -f deployments/kubernetes/

# Check deployment status
kubectl rollout status deployment/otel-cost-exporter

# Verify pods are running
kubectl get pods -l app=otel-cost-exporter

# Check logs
kubectl logs -l app=otel-cost-exporter --tail=50
```

#### Deploy with Helm

```bash
# Add repository
helm repo add otel-cost-exporter https://reaatech.github.io/helm-charts
helm repo update

# Install chart
helm install otel-cost-exporter otel-cost-exporter/otel-cost-exporter \
  --namespace monitoring \
  --create-namespace \
  --set image.tag=v1.2.0 \
  -f values.yaml

# Upgrade existing installation
helm upgrade otel-cost-exporter otel-cost-exporter/otel-cost-exporter \
  --namespace monitoring \
  --set image.tag=v1.2.0

# Check release status
helm status otel-cost-exporter -n monitoring
```

### Docker Deployment

```bash
# Run with Docker
docker run -d \
  --name otel-cost-exporter \
  -p 8888:8888 \
  -v /path/to/config.yaml:/etc/otel-cost-exporter/config.yaml \
  ghcr.io/reaatech/otel-cost-exporter:v1.2.0

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

```bash
# Run Collector with cost exporter
otelcol --config=otel-collector-config.yaml
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
# Test pricing lookup
curl -X POST http://localhost:8888/debug/pricing \
  -d '{"model": "gpt-4", "input_tokens": 1000, "output_tokens": 500}'

# Expected response:
# {
#   "model": "gpt-4",
#   "provider": "openai",
#   "input_cost": 0.03,
#   "output_cost": 0.03,
#   "total_cost": 0.06
# }

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
# otel_cost_exporter_pricing_table_version{provider="openai"} 20240115
```

## Rollback Procedure

### Quick Rollback

```bash
# Kubernetes rollback
kubectl rollout undo deployment/otel-cost-exporter

# Or rollback to specific revision
kubectl rollout undo deployment/otel-cost-exporter --to-revision=2

# Verify rollback
kubectl rollout status deployment/otel-cost-exporter
```

### Helm Rollback

```bash
# List release history
helm history otel-cost-exporter -n monitoring

# Rollback to previous version
helm rollback otel-cost-exporter -n monitoring

# Or rollback to specific revision
helm rollback otel-cost-exporter 2 -n monitoring
```

### npm Rollback

```bash
# Revert to previous npm version
npm deprecate otel-cost-exporter@1.2.0 "Rolling back to 1.1.0 due to critical bug"

# Republish last stable version as latest
npm dist-tag add otel-cost-exporter@1.1.0 latest
```

### Emergency Rollback

```bash
# Stop all instances
kubectl scale deployment otel-cost-exporter --replicas=0

# Deploy previous stable version
kubectl set image deployment/otel-cost-exporter \
  otel-cost-exporter=ghcr.io/reaatech/otel-cost-exporter:v1.1.0

# Scale back up
kubectl scale deployment otel-cost-exporter --replicas=2

# Monitor closely
kubectl logs -f -l app=otel-cost-exporter
```

## Hotfix Procedure

### Critical Hotfix

1. **Create hotfix branch**
   ```bash
   git checkout -b hotfix/critical-fix v1.2.0
   ```

2. **Apply fix and test**
   ```bash
   # Make changes
   # ...

   # Run tests
   pnpm test
   ```

3. **Create hotfix release**
   ```bash
   git commit -m "fix: critical bug fix"
   git tag -a v1.2.1 -m "Hotfix v1.2.1"
   git push origin v1.2.1
   ```

4. **Deploy hotfix**
   ```bash
   kubectl set image deployment/otel-cost-exporter \
     otel-cost-exporter=ghcr.io/reaatech/otel-cost-exporter:v1.2.1
   ```

## Best Practices

1. **Always tag releases** - Use annotated and signed tags
2. **Update CHANGELOG** - Document all changes
3. **Test thoroughly** - Run full test suite before release
4. **Use CI/CD** - Automate build and release process
5. **Monitor after release** - Watch for errors and performance issues
6. **Have rollback plan** - Be prepared to rollback quickly
7. **Communicate changes** - Notify users of important changes
8. **Security first** - Scan for vulnerabilities before release

## Release Schedule

| Release Type | Frequency | Process |
|--------------|-----------|---------|
| Patch | As needed | Automated with manual approval |
| Minor | Monthly | Full release process |
| Major | Quarterly | Extended testing period |

## Version Support Policy

| Version | Support Status | End of Life |
|---------|----------------|-------------|
| v1.2.x | Current | - |
| v1.1.x | Maintenance | 3 months after v1.2.0 |
| v1.0.x | End of Life | 3 months after v1.1.0 |
