# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x     | :white_check_mark: |

## Reporting a Vulnerability

**Do not open a public issue.** Instead, please email:

**rick@reaatech.com**

You should receive a response within 48 hours. If the vulnerability is confirmed, a patch release will be prepared and published as quickly as possible.

### What to Include

- A clear description of the vulnerability
- Steps to reproduce or a proof-of-concept
- Affected versions
- Any potential mitigations you've identified

### Disclosure Timeline

1. Report received — auto-acknowledgement within 48 hours
2. Vulnerability confirmed — fix developed privately
3. Patch released — public advisory published
4. CVE requested if applicable

## Scope

This policy covers the core `otel-cost-exporter` library, CLI tool, and Docker image. It does not cover:

- Dependencies (report those to the upstream project)
- Deployment configurations in example files
- Issues in development-only tooling

## Security Best Practices

When deploying otel-cost-exporter:

- **Never expose the health/debug server** (port 8889) to public networks
- **Use HTTPS** for OTLP export endpoints in production
- **Run as non-root** in containers (the published Docker image does this by default)
- **Set `OTEL_COST_LOG_LEVEL=warn`** in production to minimize log volume
- **Audit custom pricing tables** before loading — they are parsed as YAML and validated with Zod

## Privacy Guarantees

otel-cost-exporter processes only OpenTelemetry metadata attributes:

- `gen_ai.system` — provider identifier
- `gen_ai.request.model` — model name
- `gen_ai.usage.input_tokens` — token count
- `gen_ai.usage.output_tokens` — token count
- `gen_ai.usage.cache_read_input_tokens` — token count
- `gen_ai.usage.cache_creation_input_tokens` — token count

It **never** accesses, logs, or transmits LLM prompts, completions, or any content-bearing span attributes.
