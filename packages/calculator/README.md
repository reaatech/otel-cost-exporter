# @reaatech/otel-cost-exporter-calculator

[![npm version](https://img.shields.io/npm/v/@reaatech/otel-cost-exporter-calculator.svg)](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-calculator)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/reaatech/otel-cost-exporter/blob/main/LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/reaatech/otel-cost-exporter/ci.yml?branch=main&label=CI)](https://github.com/reaatech/otel-cost-exporter/actions/workflows/ci.yml)

> **Status:** Pre-1.0 — APIs may change in minor versions. Pin to a specific version in production.

LLM token cost calculator with model name normalization, provider detection, and LRU pricing caching. Converts raw token counts from GenAI semantic convention spans into per-model cost breakdowns in USD.

## Installation

```bash
npm install @reaatech/otel-cost-exporter-calculator
# or
pnpm add @reaatech/otel-cost-exporter-calculator
```

## Feature Overview

- **Cost calculator engine** — full `CostCalculator` with dependency injection: pricing provider, LRU cache, model normalizer, and optional default price
- **Pure calculation function** — `calculateCost()` is a side-effect-free function taking a `PriceEntry` and token counts, returning a `CostBreakdown`
- **Model name normalization** — strips provider prefixes (`openai/gpt-4`), version suffixes (`-v2`, `:latest`), regional variants (`-us`, `-eu`), FT prefixes, and resolves common aliases (`gpt4` → `gpt-4`)
- **Provider detection** — infers provider from model name when `gen_ai.system` is missing (e.g., `gpt-*` → `openai`, `claude-*` → `anthropic`)
- **LRU pricing cache** — configurable LRU cache with hit/miss statistics; minimizes repeated pricing table lookups in high-throughput pipelines
- **Prompt caching costs** — separate tracking for cache read and cache creation token costs (Anthropic)
- **Billable input token calculation** — automatically subtracts cache read tokens from input tokens before pricing
- **Default price fallback** — optionally assign a USD-per-1M-token default for unknown models
- **Dual ESM/CJS output** — works with `import` and `require`

## Quick Start

```typescript
import {
  createCostCalculator,
  createModelNormalizer,
  createPricingCache,
} from "@reaatech/otel-cost-exporter-calculator";
import { loadPricingData, createPricingTable } from "@reaatech/otel-cost-exporter-pricing";

// Set up dependencies
const data = await loadPricingData();
const pricing = createPricingTable(data);
const cache = createPricingCache();
const normalizer = createModelNormalizer();

const calculator = createCostCalculator({
  pricing,
  cache,
  normalizer,
  defaultPrice: 2.0,    // USD per 1M tokens for unknown models
});

// Calculate cost
const result = calculator.calculate("gpt-4", 1_000_000, 500_000, {
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
});

console.log(`Input cost: $${result.inputCostUsd}`);
console.log(`Output cost: $${result.outputCostUsd}`);
console.log(`Total cost: $${result.totalCostUsd}`);
```

## API Reference

### Cost Calculator Engine

#### `createCostCalculator(deps)`

Creates a full cost calculator with caching and normalization.

```typescript
function createCostCalculator(deps: CostCalculatorDeps): CostCalculator
```

#### `CostCalculatorDeps`

| Property | Type | Description |
|----------|------|-------------|
| `pricing` | `{ getPrice(model, provider): PriceEntry \| null }` | Pricing provider (typically from `@reaatech/otel-cost-exporter-pricing`) |
| `cache` | `PricingCache` | LRU cache instance |
| `normalizer` | `ModelNormalizer` | Model name normalizer instance |
| `defaultPrice` | `number?` | Fallback USD-per-1M-token price for unknown models |

#### `CostCalculator`

| Method | Description |
|--------|-------------|
| `calculate(model, inputTokens, outputTokens, options?)` | Compute full cost including caching — returns `CostResult` |

#### `CostResult`

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` | Canonical model name (after normalization) |
| `provider` | `string` | Provider name |
| `inputTokens` | `number` | Raw input token count |
| `outputTokens` | `number` | Raw output token count |
| `cacheReadTokens` | `number` | Cache read input tokens (Anthropic) |
| `cacheCreationTokens` | `number` | Cache creation input tokens (Anthropic) |
| `inputCostUsd` | `number` | Input cost in USD |
| `outputCostUsd` | `number` | Output cost in USD |
| `cacheReadCostUsd` | `number` | Cache read cost in USD |
| `cacheCreationCostUsd` | `number` | Cache creation cost in USD |
| `totalCostUsd` | `number` | Sum of all costs, rounded to 6 decimal places |

#### `PricingError`

| Error Code | When |
|------------|------|
| `MODEL_NOT_FOUND` | Model is unknown and no `defaultPrice` is configured |
| `INVALID_PRICE` | Negative token count provided |
| `TABLE_NOT_LOADED` | Pricing table was not initialized |

### Low-Level Calculation

#### `calculateCost(entry, inputTokens, outputTokens, cacheReadTokens?, cacheCreationTokens?)`

Pure function that converts token counts to a `CostBreakdown`:

```typescript
function calculateCost(
  entry: PriceEntry,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens?: number,
  cacheCreationTokens?: number,
): CostBreakdown
```

Automatically computes billable input tokens as `max(0, inputTokens - cacheReadTokens)` before pricing.

### Model Normalizer

#### `createModelNormalizer()`

Creates a model name normalizer with built-in aliases:

```typescript
function createModelNormalizer(): ModelNormalizer
```

#### `ModelNormalizer`

| Method | Description |
|--------|-------------|
| `normalize(modelName, system?)` | Resolve a raw model name to `{ provider, canonicalName }` or `null` |
| `addAlias(alias, canonical)` | Register a custom alias |

#### Built-in provider detection

| Pattern | Provider |
|---------|----------|
| `gpt-*`, `text-davinci-*` | `openai` |
| `claude-*` | `anthropic` |
| `gemini-*` | `google` |
| `llama-*`, `titan-*` | `aws-bedrock` |

#### Built-in aliases

| Alias | Canonical |
|-------|-----------|
| `gpt4` | `gpt-4` |
| `gpt35` | `gpt-3.5-turbo` |
| `gpt-35-turbo` | `gpt-3.5-turbo` |
| `claude-opus` | `claude-3-opus-20240229` |
| `claude-sonnet` | `claude-3-5-sonnet-20241022` |
| `claude-haiku` | `claude-3-haiku-20240307` |
| `gemini-pro` | `gemini-1.5-pro` |
| `gemini-flash` | `gemini-1.5-flash` |

### Pricing Cache

#### `createPricingCache(maxSize?)`

LRU pricing entry cache with configurable size:

```typescript
function createPricingCache(maxSize?: number): PricingCache
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxSize` | `1000` | Maximum cache entries before LRU eviction |

#### `PricingCache`

| Method | Description |
|--------|-------------|
| `get(model, provider)` | Retrieve a cached `PriceEntry` or `undefined` |
| `set(model, provider, entry)` | Store a `PriceEntry` in the cache |
| `has(model, provider)` | Check if an entry is cached |
| `size` | Current number of cached entries |
| `clear()` | Clear all cached entries and reset stats |
| `stats()` | Return `CacheStats` |

#### `CacheStats`

| Property | Description |
|----------|-------------|
| `hits` | Number of successful cache retrievals |
| `misses` | Number of failed cache retrievals |
| `size` | Current cache size |
| `maxSize` | Maximum cache size |
| `hitRate` | `hits / (hits + misses)` — `0` when no lookups |

## Usage Patterns

### Cache Statistics Monitoring

```typescript
const cache = createPricingCache(5000);

// After processing a batch of spans...
const stats = cache.stats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
console.log(`Entries: ${stats.size}/${stats.maxSize}`);
```

### Custom Model Aliases

```typescript
const normalizer = createModelNormalizer();

// Register a custom alias for your fine-tuned model
normalizer.addAlias("my-finance-gpt", "gpt-4");

const result = normalizer.normalize("my-finance-gpt");
// → { provider: "openai", canonicalName: "gpt-4" }
```

### Unknown Model Fallback

```typescript
// With defaultPrice set, unknown models get a fallback price
const calculator = createCostCalculator({
  pricing,
  cache,
  normalizer,
  defaultPrice: 2.0,
});

// "nonexistent-model" will use $2.00/1M tokens for both input and output
const result = calculator.calculate("nonexistent-model", 100, 50);
console.log(result.totalCostUsd); // ~0.0003 (very small)
```

## Related Packages

- [`@reaatech/otel-cost-exporter-core`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-core) — Domain types, Zod schemas, and semconv constants
- [`@reaatech/otel-cost-exporter-pricing`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter-pricing) — Pricing table management with bundled provider data
- [`@reaatech/otel-cost-exporter`](https://www.npmjs.com/package/@reaatech/otel-cost-exporter) — OTel-native cost metrics exporter

## License

[MIT](https://github.com/reaatech/otel-cost-exporter/blob/main/LICENSE)
