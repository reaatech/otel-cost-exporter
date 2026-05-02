# Skill: Security Review

<!--
  Implementation Status: PLANNING
  Target Phase: 4 (Production Readiness)
  Prerequisites: Phase 1-3 (Foundation, Core, Integration)
  Note: Features referenced here (audit logging, admin endpoints)
        are planned for Phase 4+ and may not be implemented in initial releases.
-->

## Overview

This security review checklist provides comprehensive guidelines for ensuring the security of the otel-cost-exporter system. It covers code security, dependency security, configuration security, and deployment security.

## Security Principles

1. **Zero-Content Policy**: Never log, store, or process LLM content or prompts
2. **Least Privilege**: Run with minimal required permissions
3. **Defense in Depth**: Multiple layers of security controls
4. **Secure by Default**: Secure configuration out of the box
5. **Regular Updates**: Keep dependencies and pricing tables current

## Code Security Review

### Input Validation

- [ ] All external inputs are validated and sanitized
- [ ] Configuration values are validated against Zod schemas
- [ ] Pricing table data is validated before use
- [ ] Model names are normalized and validated
- [ ] Token counts are validated as non-negative integers

### Data Handling

- [ ] No LLM content is logged or stored
- [ ] No PII is collected or processed
- [ ] Sensitive data is never logged (Pino redaction configured)
- [ ] Metrics contain only metadata, not content
- [ ] Debug endpoints are protected or disabled in production

### Error Handling

- [ ] Errors don't leak sensitive information
- [ ] Stack traces are not exposed in production
- [ ] Error messages are generic and safe
- [ ] Proper error codes are returned
- [ ] Errors are logged securely via Pino

### Authentication & Authorization

- [ ] Admin endpoints require authentication
- [ ] Debug endpoints are protected
- [ ] API keys are handled securely
- [ ] RBAC is implemented where needed
- [ ] Access logs are maintained

### Cryptography

- [ ] TLS is used for all external communications
- [ ] Certificates are validated properly (reject `NODE_TLS_REJECT_UNAUTHORIZED=0`)
- [ ] `crypto.randomBytes()` or `crypto.randomUUID()` used for random values
- [ ] No hardcoded secrets in code
- [ ] Secrets are managed via environment variables or secure storage

## Dependency Security

### Dependency Scanning

```bash
# Run dependency vulnerability scan
pnpm audit --audit-level=high

# Container image scanning
trivy fs .
grype .
```

### Dependency Review Checklist

- [ ] All dependencies are from trusted sources (npm registry)
- [ ] Dependencies are pinned via lockfile (`pnpm-lock.yaml`)
- [ ] Dependencies are regularly updated
- [ ] No known vulnerabilities in dependencies
- [ ] License compliance is verified

### Lockfile Integrity

```bash
# Verify lockfile integrity (fails if lockfile is out of sync)
pnpm install --frozen-lockfile

# Audit dependencies for known CVEs
pnpm audit --audit-level=high
```

### Container Security

```bash
# Scan container image
docker scan ghcr.io/reaatech/otel-cost-exporter:latest

# Or use trivy
trivy image ghcr.io/reaatech/otel-cost-exporter:latest

# Check for vulnerabilities
grype ghcr.io/reaatech/otel-cost-exporter:latest
```

## Configuration Security

### Secure Defaults

```yaml
# config.yaml - Secure defaults
logging:
  # Don't log sensitive data
  level: info
  format: json

pricing:
  # Use HTTPS for pricing updates
  auto_update: true
  update_url: "https://pricing.otel-cost-exporter.io/v1/tables"

export:
  # Use TLS for exports
  tls:
    enabled: true
    insecure_skip_verify: false

# Disable debug endpoints in production
debug:
  enabled: false
```

### Configuration Validation

Zod schemas validate all configuration at startup. Each package defines schemas alongside its domain types:

```typescript
// packages/core/src/schemas.ts (or package-level schemas)

import { z } from 'zod';

export const ConfigSchema = z.object({
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    format: z.enum(['json', 'pretty']),
  }),
  debug: z.object({
    enabled: z.boolean().default(false),
  }),
  // ... additional schema fields
});
```

```bash
# Validate configuration at runtime
tsx scripts/security-check.ts config.yaml
```

### Secrets Management

- [ ] No secrets in configuration files
- [ ] Secrets are loaded from environment variables (e.g., `process.env`)
- [ ] Secrets are loaded from secure storage (Vault, etc.)
- [ ] API keys are rotated regularly
- [ ] Secrets are not logged (Pino redaction for sensitive keys)

## Deployment Security

### Kubernetes Security

#### Pod Security

```yaml
# deployments/kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-cost-exporter
spec:
  template:
    spec:
      # Use non-root user
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000

      containers:
      - name: otel-cost-exporter
        securityContext:
          # Read-only root filesystem
          readOnlyRootFilesystem: true
          # Don't allow privilege escalation
          allowPrivilegeEscalation: false
          # Drop all capabilities
          capabilities:
            drop:
              - ALL
```

#### Network Policies

```yaml
# deployments/kubernetes/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: otel-cost-exporter
spec:
  podSelector:
    matchLabels:
      app: otel-cost-exporter
  policyTypes:
    - Ingress
    - Egress
  ingress:
    # Only allow metrics scraping
    - ports:
        - port: 8888
          protocol: TCP
  egress:
    # Only allow pricing updates
    - to:
        - namespaceSelector:
            matchLabels:
              name: kube-system
      ports:
        - port: 53
          protocol: UDP
    # Allow HTTPS for pricing updates
    - ports:
        - port: 443
          protocol: TCP
```

#### RBAC

```yaml
# deployments/kubernetes/rbac.yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: otel-cost-exporter
rules:
  # Minimal permissions
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get"]
    resourceNames: ["otel-cost-exporter-config"]
```

### Container Security

#### Dockerfile Security

```dockerfile
# docker/Dockerfile
FROM node:22-alpine AS base
RUN npm install -g pnpm@10

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json biome.json ./
COPY packages/ ./packages/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/turbo.json ./turbo.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/biome.json ./biome.json
COPY --from=builder /app/packages ./packages
RUN pnpm install --prod --frozen-lockfile

EXPOSE 8888 8889
CMD ["node", "packages/cli/dist/cli.js", "serve"]
```

#### Image Security Checklist

- [ ] Use minimal base images (alpine, distroless)
- [ ] Run as non-root user
- [ ] Read-only filesystem where possible
- [ ] No unnecessary packages (use `--prod` install)
- [ ] Scan for vulnerabilities regularly (trivy, grype)

### Pricing Table Security

#### Table Verification

```typescript
// packages/pricing/src/loader.ts

import { createHash } from 'node:crypto';
import type { PricingTable } from './types.js';
import { PricingTableSchema } from './schemas.js';

/**
 * Verify table integrity via SHA-256 hash or signature.
 * Ensures the pricing table hasn't been tampered with.
 */
export function verifyTableSignature(
  table: Buffer,
  signature: Buffer,
  publicKey: string,
): boolean {
  const hash = createHash('sha256').update(table).digest('hex');
  return crypto.verify(
    'sha256',
    table,
    { key: publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING },
    signature,
  );
}

/**
 * Validate table data against the Zod schema.
 */
export function validateTableSchema(data: unknown): PricingTable {
  return PricingTableSchema.parse(data);
}
```

#### Secure Table Loading

- [ ] Tables are downloaded over HTTPS
- [ ] Table signatures are verified
- [ ] Table schema is validated via Zod
- [ ] Tables are loaded with proper filesystem permissions
- [ ] Invalid tables are rejected safely

## Runtime Security

### Process Security

```bash
# Run the CLI serve command
node packages/cli/dist/cli.js serve \
  --config=/etc/otel-cost-exporter/config.yaml
```

### Resource Limits

```yaml
# config.yaml
resources:
  # Memory limits
  memory_limit: 512Mi

  # CPU limits
  cpu_limit: 500m

  # Event loop max listeners
  max_event_listeners: 100
```

### Audit Logging

```yaml
# config.yaml
audit:
  enabled: true
  log_file: /var/log/otel-cost-exporter/audit.log
  events:
    - config_change
    - pricing_update
    - export_failure
    - auth_failure
```

## Security Testing

### Static Analysis

```bash
# Run Biome linting
pnpm lint

# Run dependency audit
pnpm audit --audit-level=high

# TypeScript type-checking catches many bugs at compile time
pnpm typecheck
```

Biome serves as both the linter and formatter for this project. It enforces recommended rules plus strict checks on `noExplicitAny` and `noNonNullAssertion`. No ESLint plugins are required.

### Dynamic Analysis

```bash
# Run unit and integration tests
pnpm test

# Run with coverage (Vitest)
pnpm test:coverage
```

For fuzzing and mutation testing, consider:
- `jsfuzz` for property-based/fuzz testing of critical parsing paths
- Manual injection testing via debug endpoints (see Penetration Testing below)

### Penetration Testing

```bash
# Test debug endpoints
curl http://localhost:8888/debug/config
curl http://localhost:8888/debug/cache

# Test injection
curl -X POST http://localhost:8888/debug/pricing \
  -d '{"model": "\"; process.exit(); //"}'

# Test authentication bypass
curl http://localhost:8888/admin/config
```

## Security Checklist

### Pre-Deployment

- [ ] All dependencies scanned for vulnerabilities (`pnpm audit`)
- [ ] Container image scanned for vulnerabilities (trivy, grype)
- [ ] Configuration reviewed for security issues
- [ ] Secrets are properly managed
- [ ] RBAC is configured correctly
- [ ] Network policies are in place
- [ ] Resource limits are set
- [ ] Audit logging is enabled

### Post-Deployment

- [ ] Monitor for security alerts
- [ ] Review access logs regularly
- [ ] Update dependencies promptly (`pnpm update`)
- [ ] Rotate secrets regularly
- [ ] Review pricing table updates
- [ ] Monitor for anomalous behavior
- [ ] Test incident response procedures

### Regular Reviews

- [ ] Monthly dependency security review
- [ ] Quarterly full security audit
- [ ] Annual penetration testing
- [ ] After any security incident

## Incident Response

### Security Incident Procedure

1. **Identify**
   - Detect security incident
   - Assess severity and impact
   - Document initial findings

2. **Contain**
   - Isolate affected systems
   - Prevent further damage
   - Preserve evidence

3. **Eradicate**
   - Remove threat
   - Fix vulnerability
   - Update security controls

4. **Recover**
   - Restore systems
   - Verify security
   - Monitor for recurrence

5. **Learn**
   - Conduct post-mortem
   - Update procedures
   - Improve security controls

### Contact Information

- **Security Team**: security@reaatech.io
- **Bug Bounty**: https://github.com/reaatech/otel-cost-exporter/security

## Compliance

### Data Protection

- [ ] GDPR compliance for EU users
- [ ] CCPA compliance for California users
- [ ] No personal data collection
- [ ] Data minimization principles
- [ ] Right to deletion supported

### Industry Standards

- [ ] SOC 2 Type II controls
- [ ] ISO 27001 alignment
- [ ] NIST Cybersecurity Framework
- [ ] CIS Benchmarks

## Security Resources

### Tools

| Tool | Purpose |
|------|---------|
| `pnpm audit` | Dependency vulnerability scanning |
| Biome | Static code analysis and formatting |
| `trivy` | Container scanning |
| `grype` | SBOM and vulnerability scanning |
| `zod` | Runtime schema validation of all inputs |
| OWASP ZAP | Dynamic security testing |

### References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Kubernetes Security Best Practices](https://kubernetes.io/docs/concepts/security/)
- [Container Security Best Practices](https://hub.docker.com/security)

## Security Updates

### Staying Informed

- Subscribe to security mailing lists
- Monitor CVE databases
- Follow dependency security advisories (`pnpm audit` output)
- Participate in security communities

### Update Procedure

```bash
# Audit for security vulnerabilities
pnpm audit --audit-level=high

# Apply security patches
pnpm update

# Verify lockfile integrity after update
pnpm install --frozen-lockfile

# Verify after update (tests, lint, typecheck)
pnpm test && pnpm lint && pnpm typecheck
```
