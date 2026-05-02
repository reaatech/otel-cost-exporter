# otel-cost-exporter

[![CI](https://github.com/reaatech/otel-cost-exporter/actions/workflows/ci.yml/badge.svg)](https://github.com/reaatech/otel-cost-exporter/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)

> Production-ready OpenTelemetry-native cost metrics exporter for every LLM call. Bundled pricing tables, zero maintenance.

This monorepo provides a complete pipeline for converting GenAI semantic convention spans into real-time USD cost metrics. It ships with pre-validated pricing tables for OpenAI, Anthropic, Google, AWS Bedrock, and Azure — updated on patch releases so your team never has to maintain pricing data.

## Features

- **Zero-pricing-maintenance** — Bundled pricing YAML tables for all major LLM providers, updated per patch release
- **OTel-native** — Reads GenAI semantic convention spans and emits standard OpenTelemetry counter metrics in USD
- **Two deployment modes** — In-process SpanProcessor for the Node.js SDK, or standalone collector service via OTLP
- **Three export formats** — Prometheus (pull), OTLP (push), and JSON (stdout/debug)
- **Model name normalization** — Strips provider prefixes, version suffixes, regional variants, and resolves common aliases
- **Prompt caching support** — Separate cost tracking for Anthropic cache read and cache creation tokens
- **Configurable fallback pricing** — Default price for unknown models prevents gaps in cost tracking
- **Custom pricing overrides** — Merge custom YAML tables to override or extend any provider
- **LRU pricing cache** — Configurable hit/miss statistics for high-throughput pipelines
- **Config hot-reload** — File watcher with debounced reload for zero-downtime configuration changes
- **Privacy-first** — Processes only metadata; never inspects or logs LLM content, prompts, or responses

## Installation

### Using the packages

Packages are published under the `@reaatech` scope and can be installed individually:

```bash
# Core domain types, schemas, and semconv constants
pnpm add @reaatech/otel-cost-exporter-core

# Pricing table management with bundled provider data
pnpm add @reaatech/otel-cost-exporter-pricing

# Token cost calculator with model normalization and caching
pnpm add @reaatech/otel-cost-exporter-calculator

# OTel-native cost metrics exporter (library)
pnpm add @reaatech/otel-cost-exporter

# CLI for running the collector and managing pricing
pnpm add @reaatech/otel-cost-exporter-cli
```

### Contributing

```bash
# Clone the repository
git clone https://github.com/reaatech/otel-cost-exporter.git
cd otel-cost-exporter

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the test suite
pnpm test

# Run linting
pnpm lint
```

## Quick Start

Integrate the cost exporter into your Node.js OpenTelemetry SDK:

```typescript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { metrics } from "@opentelemetry/api";
import {
  loadConfig,
  createProcessorFactory,
  createCostSpanProcessor,
  createMetricsBuilder,
} from "@reaatech/otel-cost-exporter";

const config = await loadConfig();

// Build the cost processor pipeline
const factory = createProcessorFactory(config);
const costProcessor = await factory.createProcessor();

// Create metrics
const meter = metrics.getMeter("otel-cost-exporter");
const metricsBuilder = createMetricsBuilder(meter, config.metrics.prefix);

// Wire into the OTel SDK
const costSpanProcessor = createCostSpanProcessor({
  costProcessor,
  metricsBuilder,
});

const sdk = new NodeSDK({
  spanProcessors: [costSpanProcessor],
});
await sdk.start();
```

Run as a standalone collector:

```bash
otel-cost-exporter serve --port 4317 --metrics-port 8888
```

## Packages

| Package | Description |
| ------- | ----------- |
| [`@reaatech/otel-cost-exporter-core`](./packages/core) | Domain types, Zod schemas, and GenAI semantic conventions |
| [`@reaatech/otel-cost-exporter-pricing`](./packages/pricing) | Pricing table management with bundled provider data |
| [`@reaatech/otel-cost-exporter-calculator`](./packages/calculator) | Token cost calculator with model normalization and LRU caching |
| [`@reaatech/otel-cost-exporter`](./packages/exporter) | OTel-native cost metrics exporter (span processor, metrics, exporters, collector) |
| [`@reaatech/otel-cost-exporter-cli`](./packages/cli) | CLI for running the collector and managing pricing tables |

### Dependency Graph

```
core ────────────── leaf (zod, pino, semconv)
 ├── pricing ───── depends on core + yaml
 │    └── calculator ── depends on pricing + core
 │         └── exporter ─── depends on calculator + core + OTel SDKs
 │              └── cli ─────── depends on exporter + commander
```

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — System design, package relationships, and data flows
- [`AGENTS.md`](./AGENTS.md) — Coding conventions and development guidelines
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — Contribution workflow and release process
- [`skills/`](./skills/) — Maintenance procedures (pricing updates, model additions, troubleshooting, releases)

## License

[MIT](LICENSE)
