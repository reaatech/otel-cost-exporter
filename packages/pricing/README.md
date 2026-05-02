# @reaatech/otel-cost-exporter-pricing

[![npm version](https://img.shields.io/npm/v/@reaatech/otel-cost-exporter-pricing.svg)](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-pricing)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/otel-cost-exporter/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/otel-cost-exporter/ci.yml?branch=main&label=CI)](https://github.com/reaatech/otel-cost-exporter/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

LLM pricing table management with bundled provider data for OpenAI, Anthropic, Google, AWS Bedrock, and Azure. Ships with pre-validated YAML pricing files that are updated on patch releases so your team never has to maintain pricing data.

## Installation

```bash
npm install @reaatech/otel-cost-exporter-pricing
# or
pnpm add @reaatech/otel-cost-exporter-pricing
```

## Feature Overview

- **Bundled pricing** — YAML tables for OpenAI (17 models), Anthropic (7), Google (7), AWS Bedrock (14), Azure (9)
- **Exact and wildcard matching** — `getPrice(model, provider)` supports exact matches and `gpt-4-*` style wildcards
- **Custom overrides** — merge custom YAML pricing files to override or extend bundled tables
- **Prompt caching support** — tracks `cacheReadPrice` and `cacheCreationPrice` for Anthropic models
- **Versioned tables** — each YAML file carries `version` and `last_updated` metadata
- **Zod validation** — all YAML data is validated at load time against `PriceEntryYamlSchema`
- **Multi-provider merging** — loads all bundled tables in parallel and merges provider data, with custom tables taking precedence
- **Dual ESM/CJS output** — works with `import` and `require`

## Quick Start

```typescript
import { loadPricingData, createPricingTable } from "@reaatech/otel-cost-exporter-pricing";

// Load all bundled tables
const data = await loadPricingData();

console.log(`Loaded ${data.providers.size} providers, version ${data.version}`);

// Create the in-memory pricing table
const table = createPricingTable(data);

// Look up a model price
const entry = table.getPrice("gpt-4", "openai");
if (entry) {
  console.log(`Input: $${entry.inputTokenPrice}/1M tokens`);
  console.log(`Output: $${entry.outputTokenPrice}/1M tokens`);
}

// Check support
console.log(table.supports("openai"));           // true
console.log(table.supports("openai", "gpt-4"));  // true
console.log(table.supports("openai", "gpt-5"));  // false

// Total model count
console.log(`${table.modelCount} models tracked`);
```

## API Reference

### `loadPricingData(options?)`

Loads all bundled pricing YAML files and optional custom overrides in parallel.

```typescript
function loadPricingData(options?: LoaderOptions): Promise<PricingTableData>
```

### `LoaderOptions`

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `tablesDir` | `string` | Auto-detected | Directory containing pricing YAML files |
| `customTables` | `Record<string, string>` | `{}` | Provider name → custom YAML file path mappings |
| `logger` | `{ warn(...) }` | No-op | Optional warning logger for failed table loads |

### `PricingTableData`

| Property | Type | Description |
|----------|------|-------------|
| `version` | `string` | Highest version across all loaded tables |
| `lastUpdated` | `string` | Most recent `last_updated` date |
| `providers` | `Map<string, Map<string, PriceEntry>>` | Provider → model → pricing entry |

### `createPricingTable(data)`

Creates the in-memory pricing table from loaded data.

```typescript
function createPricingTable(data: PricingTableData): PricingTable
```

### `PricingTable`

| Method | Description |
|--------|-------------|
| `getPrice(model, provider)` | Exact and wildcard lookup — returns `PriceEntry` or `null` |
| `supports(provider)` | Check if a provider has any entries |
| `supports(model, provider)` | Check if a specific model is supported by a provider |
| `getAllModels(provider)` | Return all model-price entries for a provider |
| `modelCount` | Total number of model entries across all providers |
| `providers` | Read-only `Map` of provider names to their model-price maps |
| `version` | Highest version string across loaded tables |
| `lastUpdated` | Most recent `last_updated` date |
| `load()` | Reload pricing data from the default tables directory |
| `update()` | Reload and merge — functionally equivalent to `load()` |

## Custom Pricing Tables

Override or extend bundled pricing with a custom YAML file:

```yaml
# custom-pricing.yaml
version: "2026.04"
last_updated: "2026-04-27T00:00:00Z"

providers:
  openai:
    models:
      gpt-4:
        input_token_price: 28.0      # Override bundled price
        output_token_price: 56.0
        effective_date: "2026-04-01T00:00:00Z"

  custom-provider:                   # Add a new provider
    display_name: "Custom Provider"
    models:
      my-model:
        input_token_price: 5.0
        output_token_price: 10.0
        effective_date: "2026-01-01T00:00:00Z"
```

```typescript
const data = await loadPricingData({
  customTables: { custom: "./custom-pricing.yaml" },
});
```

## Bundled Providers

| Provider | System Attribute | Models | Cache Pricing |
|----------|-----------------|--------|---------------|
| OpenAI | `openai` | 17 | — |
| Anthropic | `anthropic` | 7 | Cache read + creation |
| Google | `google` | 7 | — |
| AWS Bedrock | `aws-bedrock` | 14 | — |
| Azure | `azure` | 9 | — |

## Related Packages

- [`@reaatech/otel-cost-exporter-core`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-core) — Domain types, Zod schemas, and semconv constants
- [`@reaatech/otel-cost-exporter-calculator`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-calculator) — Token cost calculator with model normalization and caching
- [`@reaatech/otel-cost-exporter`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter) — OTel-native cost metrics exporter

## License

[MIT](https://github.com/reaatech/otel-cost-exporter/blob/main/LICENSE)
