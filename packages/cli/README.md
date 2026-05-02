# @reaatech/otel-cost-exporter-cli

[![npm version](https://img.shields.io/npm/v/@reaatech/otel-cost-exporter-cli.svg)](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/otel-cost-exporter/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/otel-cost-exporter/ci.yml?branch=main&label=CI)](https://github.com/reaatech/otel-cost-exporter/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Command-line interface for the otel-cost-exporter. Start a collector service, validate pricing tables, generate cost reports from span data, and inspect configuration — all from the terminal.

## Installation

```bash
npm install @reaatech/otel-cost-exporter-cli
# or
pnpm add @reaatech/otel-cost-exporter-cli
```

Or install globally:

```bash
npm install -g @reaatech/otel-cost-exporter-cli
```

## Commands

### `otel-cost-exporter serve`

Start the OTLP collector service with Prometheus metrics.

```bash
otel-cost-exporter serve [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--config <path>` | Path to YAML configuration file | — |
| `--port <number>` | Port for OTLP HTTP receiver | `4317` |
| `--metrics-port <number>` | Port for Prometheus metrics endpoint | `8888` |

The server accepts `POST /v1/traces` (JSON-encoded OTLP), serves Prometheus metrics at `GET /metrics`, and exposes health and debug endpoints.

```bash
# Start with custom config
otel-cost-exporter serve --config ./config.yaml

# Override ports
otel-cost-exporter serve --port 8080 --metrics-port 9090
```

### `otel-cost-exporter report`

Read CostSpan JSON from a file or stdin, compute costs, and output results.

```bash
otel-cost-exporter report [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--input <path>` | Path to JSON file containing a CostSpan array | stdin |
| `--format <format>` | Output format: `json` or `table` | `json` |
| `--environment <env>` | Filter spans by deployment environment | — |

```bash
# JSON output
otel-cost-exporter report --input spans.json

# Table format filtered by environment
otel-cost-exporter report --input spans.json --format table --environment production

# Pipe from stdin
cat spans.json | otel-cost-exporter report
```

Table output columns: `spanId`, `Model`, `Provider`, `In Tok`, `Out Tok`, `Total USD`.

### `otel-cost-exporter config`

Display the effective configuration with defaults, YAML file overrides, and environment variable resolution.

```bash
otel-cost-exporter config [options]
```

| Option | Description | Default |
|--------|-------------|---------|
| `--format <format>` | Output format: `json` or `yaml` | `json` |

```bash
# See merged config as JSON
otel-cost-exporter config

# Dump as YAML
otel-cost-exporter config --format yaml
```

The output shows two sections:
- `default` — the built-in `DEFAULT_CONFIG` values
- `active` — merged config from YAML file + environment variables

### `otel-cost-exporter validate`

Validate all bundled and custom pricing tables for schema compliance.

```bash
otel-cost-exporter validate
```

Reports provider count, model count per provider, and flags any invalid entries:

```
Pricing table version: 2026.04
Last updated: 2026-04-27T00:00:00Z
Providers: 5
  openai: 17 models
  anthropic: 7 models
  google: 7 models
  aws-bedrock: 14 models
  azure: 9 models
Total models: 54
All pricing tables are valid.
```

Exits with code `1` if any validation errors are found.

## Global Options

| Option | Description |
|--------|-------------|
| `--version` | Print the installed version |
| `--help` | Display help for any command |

## Docker

A multi-stage Docker image is provided at the repository root:

```dockerfile
# docker/Dockerfile
FROM node:22-alpine AS base
RUN npm install -g pnpm@10
# ... multi-stage build for monorepo
CMD ["node", "packages/cli/dist/cli.js", "serve"]
```

```bash
# Build
docker build -t otel-cost-exporter -f docker/Dockerfile .

# Run
docker run -p 4317:4317 -p 8888:8888 otel-cost-exporter
```

## Related Packages

- [`@reaatech/otel-cost-exporter`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter) — OTel-native cost metrics exporter (library)
- [`@reaatech/otel-cost-exporter-core`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-core) — Domain types, Zod schemas, and semconv constants
- [`@reaatech/otel-cost-exporter-pricing`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-pricing) — Pricing table management with bundled provider data
- [`@reaatech/otel-cost-exporter-calculator`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-calculator) — Token cost calculator with model normalization and caching

## License

[MIT](https://github.com/reaatech/otel-cost-exporter/blob/main/LICENSE)
