# otel-cost-exporter

<p align="center">
  <strong>OpenTelemetry-native cost metrics for every LLM call — bundled pricing tables, zero maintenance.</strong>
</p>

<p align="center">
  <a href="https://github.com/reaatech/otel-cost-exporter/actions"><img alt="Build Status" src="https://img.shields.io/github/actions/workflow/status/reaatech/otel-cost-exporter/ci.yaml?branch=main"></a>
  <a href="https://www.npmjs.com/package/otel-cost-exporter"><img alt="npm version" src="https://img.shields.io/npm/v/otel-cost-exporter"></a>
  <a href="https://github.com/reaatech/otel-cost-exporter/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/npm/l/otel-cost-exporter"></a>
  <a href="https://nodejs.org"><img alt="Node.js" src="https://img.shields.io/node/v/otel-cost-exporter"></a>
</p>

---

## Overview

**otel-cost-exporter** is an OpenTelemetry component that converts GenAI semantic convention spans into real-time cost metrics in USD. It ships with bundled pricing tables for every major LLM provider — updated on semver patch releases — so your team never has to maintain pricing data.

| Concern | Without otel-cost-exporter | With otel-cost-exporter |
|---------|---------------------------|------------------------|
| Pricing data | Manual spreadsheets, cron jobs, scraping | Bundled tables, auto-updated |
| Cost visibility | Ad-hoc queries, BI dashboards | Prometheus/OTLP metrics in your existing pipeline |
| Model coverage | Outdated within days | Patch releases track provider changes |
| Content privacy | Risk of logging prompts/responses | Metadata-only: model name, token counts |

### How It Works

1. **Receive** OpenTelemetry spans conforming to [GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
2. **Extract** `gen_ai.system`, `gen_ai.request.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, and optional cache token attributes
3. **Normalize** model names across provider naming conventions
4. **Look up** pricing from in-memory tables (bundled YAML + optional custom overrides)
5. **Compute** input, output, and total cost in USD per span
6. **Export** cost metrics via Prometheus, OTLP, or JSON

## Features

- **Zero-pricing-maintenance** — Bundled tables for OpenAI, Anthropic, Google (Vertex AI / Gemini), AWS Bedrock, and Azure OpenAI. Pricing updates ship as patch releases.
- **OTel-native** — Reads GenAI semantic convention spans and emits standard OpenTelemetry counter metrics. Integrates with any existing OTel pipeline.
- **Two deployment modes** — Run as an in-process span processor within your Node.js SDK, or as a standalone OTLP receiver service.
- **Granular metric labels** — Each cost metric is tagged with `model` and `provider` attributes, plus any custom labels from configuration.
- **USD-per-1M-token normalization** — All prices are internally normalized to USD per 1,000,000 tokens, eliminating per-1K vs per-1M confusion across providers.
- **Model name normalization** — Handles provider prefixes (`openai/gpt-4`), version suffixes (`-v2`, `:latest`), regional variants (`-us`, `-eu`), FT prefixes, and common aliases (`gpt4` → `gpt-4`).
- **Prompt caching support** — Tracks Anthropic prompt caching costs via `gen_ai.usage.cache_read_input_tokens` and `gen_ai.usage.cache_creation_input_tokens`.
- **Configurable fallback pricing** — Set a default price for unknown models to avoid gaps in cost tracking.
- **Custom pricing overrides** — Override any provider's pricing via a YAML file or environment variables.
- **LRU pricing cache** — Configurable cache with hit/miss statistics to minimize pricing lookups.
- **Privacy-first** — Processes only metadata (model name, token counts). Never inspects or logs LLM content, prompts, or responses.
- **Graceful shutdown** — SIGTERM/SIGINT handlers flush pending batches before exit.

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 9+ (recommended) or npm

### Install

```bash
pnpm add otel-cost-exporter
```

### In-Process Span Processor

Integrate directly into your Node.js OpenTelemetry SDK:

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { metrics } from '@opentelemetry/api';
import {
  loadConfig,
  createProcessorFactory,
  createCostSpanProcessor,
  createMetricsBuilder,
} from 'otel-cost-exporter';

// Load configuration (file + env vars)
const config = await loadConfig('./otel-cost-exporter.yaml');

// Create the cost processor chain
const factory = createProcessorFactory(config);
const costProcessor = await factory.createProcessor();

const costSpanProcessor = createCostSpanProcessor({
  costProcessor,
});

// Wire up metrics
const meter = metrics.getMeter('otel-cost-exporter');
const metricsBuilder = createMetricsBuilder(
  meter,
  config.metrics.prefix,
  config.metrics.labels,
);

const sdk = new NodeSDK({
  spanProcessors: [costSpanProcessor],
  // ... your existing OTel configuration (exporters, resource, etc.)
});

sdk.start();
```

### Standalone Collector Service

Run as a standalone process that receives OTLP JSON traces and exposes cost metrics:

```bash
otel-cost-exporter serve --port 4317 --metrics-port 8888
```

The server accepts `POST /v1/traces` (JSON-encoded OTLP) on the configured port and serves Prometheus metrics on the metrics port at `/metrics`.

### CLI Commands

| Command | Description |
|---------|-------------|
| `otel-cost-exporter serve` | Start the OTLP receiver and Prometheus metrics server |
| `otel-cost-exporter report` | Read CostSpan JSON from a file or stdin, compute costs, output as JSON or table |
| `otel-cost-exporter config` | Display the effective configuration with defaults and environment overrides |
| `otel-cost-exporter validate` | Validate all bundled and custom pricing tables for schema compliance |
| `otel-cost-exporter --version` | Print the installed version |

## Emitted Metrics

All metrics are OpenTelemetry counters (monotonically increasing, in USD):

| Metric Name | Labels | Description |
|------------|--------|-------------|
| `llm.cost.input_tokens_usd` | `model`, `provider`, `*custom` | Cost of input tokens |
| `llm.cost.output_tokens_usd` | `model`, `provider`, `*custom` | Cost of output tokens |
| `llm.cost.total_usd` | `model`, `provider`, `*custom` | Total cost (input + output + cache) |

The metric name prefix is configurable via `metrics.prefix` (default: `llm_cost`). With the default prefix, the full metric name is `llm_cost.llm.cost.input_tokens_usd`. Custom labels configured in `metrics.labels` are attached to every metric as additional attributes.

Prometheus exporters automatically replace dots with underscores in metric names.

### Example Prometheus Output

```
llm_cost_llm_cost_input_tokens_usd{model="gpt-4",provider="openai",environment="production"} 0.0300
llm_cost_llm_cost_output_tokens_usd{model="gpt-4",provider="openai",environment="production"} 0.0600
llm_cost_llm_cost_total_usd{model="gpt-4",provider="openai",environment="production"} 0.0900
```

## Supported Providers

| Provider | System Attribute (`gen_ai.system`) | Models Tracked | Pricing Source |
|----------|-----------------------------------|----------------|---------------|
| **OpenAI** | `openai` | GPT-4, GPT-4 Turbo, GPT-4o, GPT-4o-mini, o1, o1-mini, o3-mini, GPT-3.5 Turbo, Embeddings | [openai.com/api/pricing](https://openai.com/api/pricing/) |
| **Anthropic** | `anthropic` | Claude 3.7 Sonnet, 3.5 Sonnet, 3.5 Haiku, Claude 3 Opus/Sonnet/Haiku | [anthropic.com/pricing](https://www.anthropic.com/pricing) |
| **Google (Vertex AI)** | `vertexai` | Gemini 2.5 Pro, 2.0 Flash, 1.5 Pro, 1.5 Flash, text-embedding-004 | [cloud.google.com/vertex-ai/pricing](https://cloud.google.com/vertex-ai/pricing) |
| **Google (GenAI)** | `google_genai` | Same Gemini models as Vertex AI | [ai.google.dev/pricing](https://ai.google.dev/pricing) |
| **AWS Bedrock** | `aws.bedrock` | Claude models (via Anthropic), Llama 3.1 70B/8B/405B (via Meta), Titan | [aws.amazon.com/bedrock/pricing](https://aws.amazon.com/bedrock/pricing/) |
| **Azure OpenAI** | `azure_openai` | GPT-4, GPT-4 Turbo, GPT-4o, GPT-4o-mini, GPT-3.5 Turbo | [azure.microsoft.com/pricing](https://azure.microsoft.com/pricing/) |

All prices are normalized to **USD per 1,000,000 tokens**. Pricing tables are versioned and include an `effective_date` for each model entry.

Anthropic models additionally track prompt caching costs:
- **Cache read** input tokens — priced at 10% of standard input price
- **Cache creation** input tokens — priced at 125% of standard input price

## Configuration

Configuration is resolved by merging three layers (last wins):

1. **Built-in defaults** (see `DEFAULT_CONFIG`)
2. **YAML configuration file** (specified via `--config` flag or `loadConfig(path)`)
3. **Environment variables** (`OTEL_COST_*`)

### YAML Reference

```yaml
# otel-cost-exporter.yaml
pricing:
  # Path to custom pricing overrides (merged with bundled tables)
  customTablePath: /etc/otel/pricing.yaml

  # Auto-update bundled pricing tables from remote
  autoUpdate: true

  # Interval between update checks (suffix: s, m, h, d)
  updateInterval: 24h

  # Remote URL for pricing table updates (uses bundled update URL if unset)
  updateURL: https://example.com/pricing-updates.yaml

  # Fallback price for unknown models (USD per 1M tokens)
  # When set, unknown models use this price for both input and output tokens
  defaultPrice: 2.0

metrics:
  # Prefix for metric names (appended before llm.cost.* names)
  prefix: llm_cost

  # Labels added to every emitted metric
  labels:
    environment: production
    team: platform
    region: us-east-1

export:
  # Export format: prometheus (pull), otlp (push), or json (stdout debug)
  format: prometheus

  # Push interval for periodic exporters (otlp, json)
  interval: 60s

  # Export endpoint (otlp: OTLP collector endpoint; json: ignored)
  endpoint: http://localhost:4318/v1/metrics

  # Health/debug HTTP server port (serve command only)
  healthPort: 8889

logging:
  # Log level: debug, info, warn, error
  level: info

  # Log format: json or text
  format: json
```

### Environment Variables

All configuration paths map to environment variables using the `OTEL_COST_` prefix with dot-separated paths converted to underscores:

| Config Path | Environment Variable | Example |
|------------|---------------------|---------|
| `pricing.customTablePath` | `OTEL_COST_PRICING_CUSTOM_TABLE_PATH` | `/etc/otel/pricing.yaml` |
| `pricing.autoUpdate` | `OTEL_COST_PRICING_AUTO_UPDATE` | `true` |
| `pricing.updateInterval` | `OTEL_COST_PRICING_UPDATE_INTERVAL` | `24h` |
| `pricing.updateURL` | `OTEL_COST_PRICING_UPDATE_URL` | (URL string) |
| `pricing.defaultPrice` | `OTEL_COST_PRICING_DEFAULT_PRICE` | `2.0` |
| `metrics.prefix` | `OTEL_COST_METRICS_PREFIX` | `llm_cost` |
| `metrics.labels` | `OTEL_COST_METRICS_LABELS` | `{"env":"prod","team":"ai"}` |
| `export.format` | `OTEL_COST_EXPORT_FORMAT` | `prometheus` |
| `export.interval` | `OTEL_COST_EXPORT_INTERVAL` | `60s` |
| `export.endpoint` | `OTEL_COST_EXPORT_ENDPOINT` | `http://localhost:4318` |
| `export.healthPort` | `OTEL_COST_EXPORT_HEALTH_PORT` | `8889` |
| `logging.level` | `OTEL_COST_LOG_LEVEL` | `info` |
| `logging.format` | `OTEL_COST_LOG_FORMAT` | `json` |

### Custom Pricing Tables

Override or extend bundled pricing by providing a YAML file at `pricing.customTablePath`:

```yaml
version: "2026.04"
last_updated: "2026-04-27T00:00:00Z"
pricing_unit: 1000000

providers:
  openai:
    models:
      gpt-4:
        input_token_price: 28.0    # Override bundled price
        output_token_price: 56.0
        effective_date: "2026-04-01T00:00:00Z"

  custom-provider:                 # Add a new provider
    display_name: "Custom Provider"
    models:
      my-custom-model:
        input_token_price: 5.0
        output_token_price: 10.0
        effective_date: "2026-01-01T00:00:00Z"
```

Custom table models take precedence over bundled tables. The merged table is validated with Zod at load time.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        APPLICATION LAYER                         │
│  ┌──────────────┐    ┌──────────────────────┐                    │
│  │ Node.js SDK  │    │ Standalone Collector  │                   │
│  │ (in-process) │    │  (serve command)      │                   │
│  └──────┬───────┘    └──────────┬───────────┘                    │
│         │                       │                                │
│         │  OTel SpanProcessor   │  HTTP POST /v1/traces (JSON)   │
│         │  (onEnd callback)     │                                │
│         ▼                       ▼                                │
│  ┌───────────────────────────────────────────────┐               │
│  │            SPAN ADAPTER LAYER                  │               │
│  │  spanToCostSpan()                              │               │
│  │  • Extracts gen_ai.* attributes                │               │
│  │  • Validates provider + model presence         │               │
│  │  • Reads cache token attributes (Anthropic)    │               │
│  │  • Parses timestamps and duration              │               │
│  │  • Returns CostSpan | null (null for non-GenAI)│               │
│  └───────────────────────┬───────────────────────┘               │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────┐               │
│  │            PROCESSOR LAYER                     │               │
│  │  createSpanProcessor()                         │               │
│  │  • Batch processor (configurable in future)    │               │
│  │  • Delegates each span to CostCalculator       │               │
│  │  • Returns ProcessResult with cost or error    │               │
│  └───────────────────────┬───────────────────────┘               │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────┐               │
│  │          CALCULATOR LAYER                      │               │
│  │  ┌───────────────────┐                        │               │
│  │  │ ModelNormalizer    │  Strips prefixes,      │               │
│  │  │                    │  resolves aliases       │               │
│  │  └────────┬──────────┘                        │               │
│  │           ▼                                    │               │
│  │  ┌───────────────────┐                        │               │
│  │  │ PricingCache (LRU) │  Check: provider:model │               │
│  │  └────────┬──────────┘                        │               │
│  │           │ (miss)                             │               │
│  │           ▼                                    │               │
│  │  ┌───────────────────┐                        │               │
│  │  │ PricingTable       │  Bundled + custom YAML │               │
│  │  │ (in-memory lookup) │  Wildcard support      │               │
│  │  └────────┬──────────┘                        │               │
│  │           ▼                                    │               │
│  │  ┌───────────────────┐                        │               │
│  │  │ calculateCost()    │  (tokens/1M) × price   │               │
│  │  │ Pure function      │  = CostBreakdown       │               │
│  │  └────────┬──────────┘                        │               │
│  └───────────┼───────────────────────────────────┘               │
│              ▼                                                   │
│  ┌───────────────────────────────────────────────┐               │
│  │            METRICS LAYER                       │               │
│  │  MetricsBuilder.recordCost(result)             │               │
│  │  • 3 OTel Counters: input/output/total cost    │               │
│  │  • Labeled: model, provider, custom labels     │               │
│  └───────────────────────┬───────────────────────┘               │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────┐               │
│  │            EXPORT LAYER                        │               │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐     │               │
│  │  │Prometheus│  │  OTLP    │  │  JSON    │     │               │
│  │  │ (pull)   │  │ (push)   │  │ (stdout) │     │               │
│  │  └──────────┘  └──────────┘  └──────────┘     │               │
│  └───────────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **Pure cost calculation** — `calculateCost()` is a pure function with no side effects; unit-testable in isolation.
- **Dependency injection** — All components accept their dependencies via constructors/factory functions, enabling clean testing and composition.
- **LRU cache** — Pricing lookups are cached with least-recently-used eviction (default max 1000 entries) to minimize repeated table lookups in high-throughput pipelines.
- **Atomic config swap** — Configuration hot-reload uses object reference assignment, which is atomic in JavaScript, avoiding torn reads.
- **Fire-and-forget batch flushes** — Batch timers are unref'd to prevent blocking process shutdown.

## Docker Deployment

A multi-stage Docker image is provided:

```dockerfile
# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# Runtime stage
FROM node:22-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/pricing-tables ./pricing-tables
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER app
EXPOSE 8888 8889
ENTRYPOINT ["dumb-init", "node", "dist/cli.js", "serve"]
```

### Run with Docker

```bash
docker build -t otel-cost-exporter .
docker run -p 4317:4317 -p 8888:8888 otel-cost-exporter
```

### Docker Compose

```yaml
services:
  cost-exporter:
    build: .
    ports:
      - "4317:4317"    # OTLP receiver
      - "8888:8888"    # Prometheus metrics
    environment:
      OTEL_COST_METRICS_PREFIX: llm_cost
      OTEL_COST_METRICS_LABELS: '{"environment":"production"}'
      OTEL_COST_LOG_LEVEL: info
    volumes:
      - ./custom-pricing.yaml:/etc/otel/pricing.yaml:ro
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8889/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    restart: unless-stopped
```

## API Reference

### Package Exports

| Export Path | Description |
|------------|-------------|
| `otel-cost-exporter` | Main library (types, config, calculator, processor, metrics, exporters) |
| `otel-cost-exporter/collector` | Collector service for standalone deployment |
| `otel-cost-exporter/pricing` | Pricing table standalone (load, query, validate) |

### Key Functions

#### `loadConfig(path?: string): Promise<Config>`
Load and merge configuration from YAML file (optional) and environment variables.

#### `createProcessorFactory(config: Config): ProcessorFactory`
Create a factory for building configured span processors.

#### `createCostSpanProcessor(options: CostSpanProcessorOptions): OtelSpanProcessor`
Create an OpenTelemetry `SpanProcessor` that extracts GenAI attributes and computes costs on span end.

#### `createMetricsBuilder(meter: Meter, prefix?: string, extraLabels?: Record<string, string>): MetricsBuilder`
Create a metrics builder that records cost results to OTel counters.

#### `calculateCost(entry: PriceEntry, inputTokens: number, outputTokens: number, cacheReadTokens?: number, cacheCreationTokens?: number): CostBreakdown`
Pure function: compute USD cost from token counts and a pricing entry.

#### `createPricingTable(data: PricingTableData[]): PricingTable`
Create an in-memory pricing table from YAML pricing data.

#### `createModelNormalizer(): ModelNormalizer`
Create a model name normalizer with built-in aliases.

### Key Types

| Type | Description |
|------|-------------|
| `CostSpan` | Parsed span with provider, model, token counts, cost breakdown |
| `PriceEntry` | Pricing for a single model (USD per 1M tokens) |
| `CostBreakdown` | Computed costs: `inputCostUsd`, `outputCostUsd`, `totalCostUsd` |
| `Config` | Complete configuration object (pricing, metrics, export, logging) |
| `CostResult` | Normalized calculation result with model/provider labels |
| `ProcessResult` | Span processing result (success with cost, or error) |
| `PricingError` | Discriminated error: `MODEL_NOT_FOUND`, `INVALID_PRICE`, `TABLE_NOT_LOADED` |

## Production Considerations

### Health Checks

The `serve` command exposes a health endpoint on port 8889 (configurable via `export.healthPort`):

| Endpoint | Response | Purpose |
|----------|----------|---------|
| `GET /health` | `200 OK` | Liveness probe |
| `GET /ready` | `200 OK` | Readiness probe |
| `GET /debug` | JSON object | Uptime, spans processed/dropped, pricing version |
| `GET /debug/pricing` | JSON object | Pricing table version, model count per provider |
| `GET /debug/cache` | JSON object | Cache hit/miss statistics |

### Resource Limits

- **Memory**: The LRU pricing cache defaults to 1000 entries. At ~1KB per entry, the cache typically uses under 2MB. Memory grows linearly with span throughput in the batch processor.
- **CPU**: Cost calculation is CPU-bound (floating-point math). At 10k spans/second, single-core utilization is typically under 5%.
- **Network**: OTLP push mode sends compressed metric payloads at the configured interval. Typical payload size is <10KB per 1000 unique model/provider combinations.

### High Availability

- Run multiple instances behind a load balancer for the OTLP receiver
- Prometheus pull mode is stateless — any instance can serve metrics
- Pricing tables are read-only at runtime; no write coordination needed

### Security

- The container runs as non-root (`app` user, UID 1001)
- Pricing tables are bundled in a read-only filesystem layer
- The exporter never inspects or logs span content, prompts, or responses
- Custom pricing tables can be mounted as read-only volumes
- Run `pnpm audit --audit-level=high` before production deployments

## Development

```bash
# Prerequisites: Node.js 22+, pnpm 9+
corepack enable && corepack prepare pnpm@9 --activate

# Install dependencies
pnpm install --frozen-lockfile

# Build TypeScript
pnpm build

# Run tests
pnpm test                # Fast unit + integration tests
pnpm test:coverage       # With coverage (thresholds enforced at >85%)
pnpm bench               # Run benchmarks

# Lint and format
pnpm lint
pnpm format
pnpm typecheck           # tsc --noEmit

# Pre-commit (runs typecheck + lint + test:coverage)
pnpm pre-commit

# Pricing table management
pnpm validate-pricing    # Validate all YAML pricing tables
pnpm generate-pricing    # Generate pricing tables from upstream sources
pnpm pricing-diff        # Show pricing changes between versions

# Security
pnpm security-scan       # npm audit at high severity
pnpm security-lint       # ESLint with no-eval enforced
```

Coverage thresholds are enforced at **>85%** across all components. Watermarks are configured in `vitest.config.ts` (70% warning, 85% error).

## Documentation

| Document | Audience | Purpose |
|----------|----------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Engineers, architects | System design, data flow, concurrency model, deployment patterns |
| [DEV_PLAN.md](DEV_PLAN.md) | Contributors | Development phases, roadmap, planned features |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contributors | Contribution guidelines, PR workflow, code standards |
| [AGENTS.md](AGENTS.md) | AI agents, maintainers | Development guidelines, coding standards, tooling reference |
| [CHANGELOG.md](CHANGELOG.md) | Everyone | Per-release change history |

### Maintenance Skills

| Skill | Purpose |
|-------|---------|
| [Pricing table updates](skills/pricing-update.md) | Automated and manual pricing update procedures |
| [Adding new models/providers](skills/model-addition.md) | Provider integration, normalization rules, testing |
| [Troubleshooting](skills/troubleshooting.md) | Common errors, debug procedures, performance tuning |
| [Release procedures](skills/release-procedure.md) | Versioning, build, deploy, post-release verification, rollback |
| [Security review](skills/security-review.md) | Code security, dependency scanning, configuration hardening |
| [npm/pnpm workflows](skills/npm-workflow.md) | Dependency management, publishing, lockfile handling |
| [Code review](skills/code-review.md) | Structured review checklist covering security, correctness, performance |
| [Documentation maintenance](skills/docs-maintenance.md) | Documentation standards, review checklist |

## License

MIT — see [LICENSE](LICENSE)

---

<p align="center">
  Built by <a href="https://reaatech.com">Reaatech</a>
</p>
