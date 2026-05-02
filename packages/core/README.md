# @reaatech/otel-cost-exporter-core

[![npm version](https://img.shields.io/npm/v/@reaatech/otel-cost-exporter-core.svg)](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/otel-cost-exporter/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/otel-cost-exporter/ci.yml?branch=main&label=CI)](https://github.com/reaatech/otel-cost-exporter/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

Core domain types, Zod schemas, GenAI semantic conventions, and shared utilities for the `@reaatech/otel-cost-exporter-*` ecosystem. This package is the single source of truth for all LLM cost domain shapes used across the exporter monorepo.

## Installation

```bash
npm install @reaatech/otel-cost-exporter-core
# or
pnpm add @reaatech/otel-cost-exporter-core
```

## Feature Overview

- **Domain types** — `PriceEntry`, `CostBreakdown`, `CostSpan`, `AggregationKey`, `TelemetryContext` define the canonical shapes for LLM cost data
- **Zod schemas** — `PriceEntrySchema`, `CostSpanSchema`, `ConfigSchema` for runtime validation at system boundaries
- **GenAI semantic conventions** — `GEN_AI_SYSTEM`, `GEN_AI_REQUEST_MODEL`, `GEN_AI_USAGE_INPUT_TOKENS`, `GEN_AI_USAGE_OUTPUT_TOKENS`, and cache token attribute constants
- **Structured logging** — Pino-based `createLogger()` factory with configurable level and format (JSON or pretty-print)
- **Interval parsing** — `parseIntervalMs()` converts human-readable duration strings (`"24h"`, `"5m"`, `"30s"`) to milliseconds
- **Constants** — `TOKENS_PER_UNIT` (1,000,000), `roundTo()` precision helper used throughout the cost calculation pipeline
- **Zero runtime dependencies beyond `pino` and `zod`** — lightweight and tree-shakeable
- **Dual ESM/CJS output** — works with `import` and `require`

## Quick Start

```typescript
import { CostSpanSchema, type CostSpan, createLogger } from "@reaatech/otel-cost-exporter-core";

// Validate a CostSpan at the boundary
const rawSpan = JSON.parse(incomingJson);
const span: CostSpan = CostSpanSchema.parse(rawSpan);

// Create a logger
const logger = createLogger("info", "json");
logger.info({ spanId: span.spanId, model: span.model }, "Processing span");
```

## Exports

### Domain Types

| Export | Description |
|--------|-------------|
| `PriceEntry` | Pricing for a single model: `inputTokenPrice`, `outputTokenPrice`, optional `cacheReadPrice`, `cacheCreationPrice`, `effectiveDate` |
| `CostBreakdown` | Computed costs: `inputCostUsd`, `outputCostUsd`, optional `cacheReadCostUsd`, `cacheCreationCostUsd` |
| `CostSpan` | Normalized span: `spanId`, `traceId`, `provider`, `model`, `inputTokens`, `outputTokens`, `cacheReadTokens?`, `cacheCreationTokens?`, `costUsd`, `costBreakdown`, `telemetry`, `timestamp`, `startTime`, `endTime`, `durationMs`, `status`, `errorMessage?` |
| `AggregationKey` | `{ provider, model, environment?, ns? }` — key for grouping spans by dimensions |
| `TelemetryContext` | Deployment metadata: `environment?`, `ns` (namespace), `service?` |

### Zod Schemas

| Export | Description |
|--------|-------------|
| `PriceEntrySchema` | Validates pricing entries — positive token prices, ISO 8601 effective date |
| `CostSpanSchema` | Validates span structure with nested cost breakdown and telemetry context |
| `ConfigSchema` | Full configuration validation — pricing, metrics, export, and logging sections |

### GenAI Semantic Conventions

| Export | Attribute Name |
|--------|---------------|
| `GEN_AI_SYSTEM` | `gen_ai.system` |
| `GEN_AI_REQUEST_MODEL` | `gen_ai.request.model` |
| `GEN_AI_USAGE_INPUT_TOKENS` | `gen_ai.usage.input_tokens` |
| `GEN_AI_USAGE_OUTPUT_TOKENS` | `gen_ai.usage.output_tokens` |
| `GEN_AI_USAGE_CACHE_READ_TOKENS` | `gen_ai.usage.cache_read_input_tokens` |
| `GEN_AI_USAGE_CACHE_CREATION_TOKENS` | `gen_ai.usage.cache_creation_input_tokens` |
| `SEMCONV_VERSION` | Pinned semantic conventions version |

### Constants

| Export | Value | Description |
|--------|-------|-------------|
| `TOKENS_PER_UNIT` | `1000000` | Tokens per pricing unit (1M) |
| `roundTo(value, decimals)` | Function | Round a number to N decimal places |

### Logging

| Export | Description |
|--------|-------------|
| `createLogger(level, format)` | Pino logger factory — accepts `"debug" | "info" | "warn" | "error"` and `"json" | "text"` |

### Utilities

| Export | Description |
|--------|-------------|
| `parseIntervalMs(value)` | Parse a duration string (`"24h"`, `"5m"`, `"30s"`, `"1h30m"`) into milliseconds |

## Usage Pattern

Every schema export has a matching type export. Use the schema for runtime validation and the type for compile-time checking:

```typescript
import { PriceEntrySchema, type PriceEntry } from "@reaatech/otel-cost-exporter-core";

// Parse at the boundary — throws ZodError on invalid data
function validatePrice(raw: unknown): PriceEntry {
  return PriceEntrySchema.parse(raw);
}
```

## Related Packages

- [`@reaatech/otel-cost-exporter-pricing`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-pricing) — Pricing table management with bundled provider data
- [`@reaatech/otel-cost-exporter-calculator`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-calculator) — Token cost calculator with model normalization and caching
- [`@reaatech/otel-cost-exporter`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter) — OTel-native cost metrics exporter

## License

[MIT](https://github.com/reaatech/otel-cost-exporter/blob/main/LICENSE)
