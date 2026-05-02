# @reaatech/otel-cost-exporter

[![npm version](https://img.shields.io/npm/v/@reaatech/otel-cost-exporter.svg)](https://www.npmjs.com/package/@reaatech/otel-cost-exporter)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/otel-cost-exporter/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/otel-cost-exporter/ci.yml?branch=main&label=CI)](https://github.com/reaatech/otel-cost-exporter/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

OpenTelemetry-native LLM cost metrics exporter. Converts GenAI semantic convention spans into real-time USD cost metrics and exports them via Prometheus, OTLP, or JSON. Ships with bundled pricing tables for every major LLM provider — zero maintenance required.

## Installation

```bash
npm install @reaatech/otel-cost-exporter
# or
pnpm add @reaatech/otel-cost-exporter
```

## Feature Overview

- **OTel-native** — reads GenAI semantic convention spans, emits standard `Counter` metrics with model and provider labels
- **Zero-pricing-maintenance** — bundled tables for OpenAI, Anthropic, Google, AWS Bedrock, and Azure updated on patch releases
- **Two deployment modes** — in-process `SpanProcessor` for the Node.js SDK, or standalone collector service via OTLP
- **Three export formats** — Prometheus (pull), OTLP (push), JSON (stdout/debug)
- **Configurable fallback pricing** — default price for unknown models prevents gaps in cost tracking
- **Custom overrides** — merge custom YAML pricing tables to override or extend any provider
- **Granular labels** — model, provider, plus any custom labels from configuration
- **Prompt caching support** — separate cost tracking for Anthropic cache read and cache creation tokens
- **Config hot-reload** — file watcher with debounced reload for zero-downtime configuration changes
- **Privacy-first** — processes only metadata; never inspects or logs LLM content, prompts, or responses
- **Dual ESM/CJS output** — works with `import` and `require`

## Quick Start

### In-Process Span Processor

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

### Collector Service

```typescript
import { loadConfig, createCollectorService } from "@reaatech/otel-cost-exporter";

const config = await loadConfig();
const service = await createCollectorService(config);

await service.start();  // OTLP receiver on :4317, Prometheus on :8888

process.on("SIGTERM", () => service.shutdown());
```

## API Reference

### Span Processing

| Export | Description |
|--------|-------------|
| `createSpanProcessor(deps)` | Creates a span processor that calculates costs for each span |
| `createBatchProcessor(inner, options?)` | Wraps a processor with batch buffering and timeout-based flushing |
| `createProcessorFactory(config)` | Factory that wires pricing tables, normalization, caching, and the cost calculator |

#### `SpanProcessor`

| Method | Description |
|--------|-------------|
| `processSpan(span: CostSpan)` | Synchronously process a single span — returns `ProcessResult` |
| `processSpans(spans: CostSpan[])` | Process multiple spans in parallel — returns `ProcessResult[]` |
| `shutdown()` | Gracefully flush any buffered spans |

#### `BatchProcessorOptions`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `maxBatchSize` | `number` | `100` | Flush after accumulating this many spans |
| `batchTimeoutMs` | `number` | `5000` | Flush after this many ms of inactivity |
| `logger` | `{ warn(...) }` | No-op | Optional logger for flush errors |

### OTel SDK Integration

| Export | Description |
|--------|-------------|
| `createCostSpanProcessor(options)` | OTel `SpanProcessor` adapter — extracts GenAI attributes on span end |
| `spanToCostSpan(span)` | Converts an OTel `ReadableSpan` to a `CostSpan` for cost calculation |

#### `CostSpanProcessorOptions`

| Property | Type | Description |
|----------|------|-------------|
| `costProcessor` | `SpanProcessor` | The cost processor (from `createSpanProcessor` or `createBatchProcessor`) |
| `metricsBuilder?` | `MetricsBuilder` | Records costs to OTel counters |
| `logger?` | `object` | Optional Pino-compatible logger |
| `onSpanRecorded?` | `(span: CostSpan) => void` | Callback fired after each span is processed |

### Metrics

| Export | Description |
|--------|-------------|
| `createMetricsBuilder(meter, prefix)` | Creates a metrics recorder that emits OTel counter metrics |
| `METRIC_INPUT_COST` | `"llm.cost.input_tokens_usd"` |
| `METRIC_OUTPUT_COST` | `"llm.cost.output_tokens_usd"` |
| `METRIC_TOTAL_COST` | `"llm.cost.total_usd"` |

#### `MetricsBuilder`

| Method | Description |
|--------|-------------|
| `recordCost(result, extraLabels?)` | Record a `CostResult` to all three counters with labels |

### Export Formats

| Export | Description |
|--------|-------------|
| `createPrometheusExporter(options?)` | Pull-based Prometheus exporter on configurable port |
| `createOtlpExporter(options?)` | Push-based OTLP HTTP exporter |
| `createJsonExporter(options?)` | Stdout JSON exporter for debugging |

### Configuration

| Export | Description |
|--------|-------------|
| `loadConfig(path?)` | Load and merge config from YAML file and environment variables |
| `createConfigService(initial, configPath?, logger?)` | Configuration service with atomic snapshot reads and file-watching hot-reload |
| `DEFAULT_CONFIG` | Built-in default configuration object |

#### `ConfigService`

| Method | Description |
|--------|-------------|
| `getSnapshot()` | Return current config (atomic read) |
| `reload()` | Re-load config from the filesystem |
| `startWatching()` | Watch the config file for changes (debounced, 500ms) |
| `stopWatching()` | Stop file watcher |

### Collector

| Export | Description |
|--------|-------------|
| `createCollectorService(config)` | Standalone OTLP pipeline service with health checks |
| `createHealthServer()` | Health check HTTP server with liveness, readiness, and debug endpoints |

#### Collector Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/traces` | OTLP JSON trace ingestion |
| `GET` | `/health` | Liveness probe |
| `GET` | `/ready` | Readiness probe |
| `GET` | `/debug` | Uptime, spans processed/dropped, pricing version |
| `GET` | `/debug/pricing` | Per-provider model counts |
| `GET` | `/debug/cache` | Cache hit/miss stats |

## Configuration Reference

Configuration is resolved by merging three layers (last wins):

1. **Built-in defaults** (`DEFAULT_CONFIG`)
2. **YAML configuration file** (via `--config` flag or `loadConfig(path)`)
3. **Environment variables** (`OTEL_COST_*`)

### `Config` Shape

| Section | Key | Type | Default | Description |
|---------|-----|------|---------|-------------|
| `pricing` | `customTablePath` | `string?` | — | Path to custom YAML pricing overrides |
| `pricing` | `defaultPrice` | `number?` | — | Fallback USD/1M tokens for unknown models |
| `metrics` | `prefix` | `string` | `"llm_cost"` | Prefix for emitted metric names |
| `metrics` | `labels` | `Record<string, string>` | `{}` | Custom labels attached to all metrics |
| `export` | `format` | `"prometheus" \| "otlp" \| "json"` | `"prometheus"` | Export format |
| `export` | `interval` | `string` | `"60s"` | Push interval for OTLP/JSON |
| `export` | `endpoint` | `string?` | — | OTLP collector endpoint |
| `export` | `healthPort` | `number` | `8889` | Health/debug HTTP server port |
| `logging` | `level` | `"debug" \| "info" \| "warn" \| "error"` | `"info"` | Log level |
| `logging` | `format` | `"json" \| "text"` | `"json"` | Log format |

## Usage Patterns

### Custom Pricing Overrides

```typescript
import { loadConfig } from "@reaatech/otel-cost-exporter";

const config = await loadConfig("./otel-cost-exporter.yaml");
```

```yaml
# otel-cost-exporter.yaml
pricing:
  customTablePath: /etc/otel/custom-pricing.yaml
  defaultPrice: 2.0

metrics:
  prefix: llm_cost
  labels:
    environment: production
    region: us-east-1

export:
  format: prometheus
  healthPort: 8889

logging:
  level: info
  format: json
```

### Config Hot-Reload

```typescript
import { DEFAULT_CONFIG, createConfigService } from "@reaatech/otel-cost-exporter";

const svc = createConfigService(DEFAULT_CONFIG, "./otel-cost-exporter.yaml");
svc.startWatching();  // Will reload on file changes (debounced 500ms)

// Get current config atomically
const config = svc.getSnapshot();

// Cleanup
svc.stopWatching();
```

### Span → CostSpan Adapter

```typescript
import { spanToCostSpan } from "@reaatech/otel-cost-exporter";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";

// In your custom SpanProcessor.onEnd():
function onEnd(otelSpan: ReadableSpan): void {
  const costSpan = spanToCostSpan(otelSpan);
  if (costSpan) {
    // Ready for cost calculation
    const result = costProcessor.processSpan(costSpan);
    metricsBuilder.recordCost(result.cost);
  }
}
```

## Related Packages

- [`@reaatech/otel-cost-exporter-core`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-core) — Domain types, Zod schemas, and semconv constants
- [`@reaatech/otel-cost-exporter-pricing`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-pricing) — Pricing table management with bundled provider data
- [`@reaatech/otel-cost-exporter-calculator`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-calculator) — Token cost calculator with model normalization and caching
- [`@reaatech/otel-cost-exporter-cli`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-cli) — CLI for running the collector and managing pricing

## License

[MIT](https://github.com/reaatech/otel-cost-exporter/blob/main/LICENSE)
