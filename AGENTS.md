# AI Agent Guidelines: otel-cost-exporter

## Overview

This document provides guidelines and instructions for AI agents working with the otel-cost-exporter codebase. It covers coding standards, architectural patterns, testing requirements, and best practices for maintaining and extending this enterprise-grade system.

## Agent Skills Directory

The `skills/` directory contains specialized knowledge and procedures for common tasks:

| Skill File | Purpose |
|------------|---------|
| `pricing-update.md` | Procedures for updating pricing tables |
| `model-addition.md` | Adding support for new LLM models/providers |
| `troubleshooting.md` | Debugging and troubleshooting guide |
| `release-procedure.md` | Release and deployment procedures |
| `security-review.md` | Security review checklist |
| `npm-workflow.md` | npm/pnpm package management workflows |
| `code-review.md` | Structured code review checklist |
| `docs-maintenance.md` | Documentation standards and maintenance |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.8+ (strict mode) |
| Runtime | Node.js 22+ |
| Package manager | pnpm 10+ |
| Build | tsup |
| Orchestration | turborepo |
| Versioning | changesets |
| Testing | Vitest 3+ with `@vitest/coverage-v8` |
| Linting | Biome 1.9+ |
| Formatting | Biome 1.9+ (formatting) |
| Logging | Pino |
| Validation | Zod |
| CLI | Commander |
| Metrics | @opentelemetry/sdk-metrics |
| Hooks | (none — Biome in CI) |

## Coding Standards

### TypeScript Code Style

```typescript
import { readFile } from 'node:fs/promises';

// External packages
import type { Meter } from '@opentelemetry/api';
import { ValueType } from '@opentelemetry/api';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

// Workspace packages
import type { PriceEntry } from '@reaatech/otel-cost-exporter-core';
import { PricingTable } from '@reaatech/otel-cost-exporter-pricing';
import type { PricingProvider } from '@reaatech/otel-cost-exporter-pricing';

// Internal (relative) imports
import { PricingTableSchema } from './schemas.js';

// Interfaces first
export interface PricingProvider {
  getPrice(model: string): { inputPrice: number; outputPrice: number } | null;
  supports(model: string): boolean;
  update(): Promise<void>;
}

// Type aliases with documentation
/**
 * Represents pricing information for a specific model.
 * All prices are in USD per 1,000,000 tokens.
 */
export interface PriceEntry {
  /** Price per 1,000,000 input tokens in USD */
  inputTokenPrice: number;

  /** Price per 1,000,000 output tokens in USD */
  outputTokenPrice: number;

  /** ISO 8601 date when this pricing became effective */
  effectiveDate: string;
}

// Zod schemas for runtime validation
export const PriceEntrySchema = z.object({
  input_token_price: z.number().positive(),
  output_token_price: z.number().positive(),
  effective_date: z.string().datetime(),
}) satisfies z.ZodType<PriceEntry>;

// Error types with discriminated unions
export class PricingError extends Error {
  constructor(
    message: string,
    public readonly code: 'MODEL_NOT_FOUND' | 'INVALID_PRICE' | 'TABLE_NOT_LOADED',
  ) {
    super(message);
    this.name = 'PricingError';
  }
}

// Documented functions with explicit return types
const TOKENS_PER_UNIT = 1_000_000;

/**
 * Computes the cost for given token counts using the provided price entry.
 *
 * @param entry - Pricing entry for the model
 * @param inputTokens - Number of input tokens consumed
 * @param outputTokens - Number of output tokens generated
 * @returns An object containing input cost, output cost, and total cost in USD
 */
export function calculateCost(
  entry: PriceEntry,
  inputTokens: number,
  outputTokens: number,
): { inputCost: number; outputCost: number; totalCost: number } {
  if (inputTokens < 0 || outputTokens < 0) {
    throw new PricingError('Token counts must be non-negative', 'INVALID_PRICE');
  }

  const inputCost = (inputTokens / TOKENS_PER_UNIT) * entry.inputTokenPrice;
  const outputCost = (outputTokens / TOKENS_PER_UNIT) * entry.outputTokenPrice;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
  };
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `cost-calculator.ts`, `pricing-table.ts` |
| Directories | kebab-case | `cost-exporter/`, `pricing-tables/` |
| Interfaces | PascalCase | `PricingProvider`, `MetricsExporter` |
| Types | PascalCase | `PriceEntry`, `CostBreakdown` |
| Functions | camelCase | `calculateCost()`, `normalizeModel()` |
| Variables | camelCase | `inputTokens`, `priceEntry` |
| Constants | UPPER_SNAKE_CASE | `TOKENS_PER_UNIT`, `DEFAULT_TIMEOUT` |
| Enums | PascalCase | `ExportFormat`, `LogLevel` |
| Error classes | `Error` suffix | `PricingError`, `ExportError` |
| Test functions | `describe`/`it` blocks with `should` | `describe('calculateCost', () => { it('should compute GPT-4 cost', () => {...}) })` |
| Schemas | `Schema` suffix | `PriceEntrySchema`, `ConfigSchema` |

### Import Order

```typescript
// 1. Node.js built-ins
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// 2. External packages
import { ValueType } from '@opentelemetry/api';
import { z } from 'zod';

// 3. Workspace packages
import type { PriceEntry } from '@reaatech/otel-cost-exporter-core';
import { PricingTable } from '@reaatech/otel-cost-exporter-pricing';

// 4. Internal (relative) imports
import { doThing } from './helpers.js';
```

### Code Organization

```
packages/
├── core/                        # @reaatech/otel-cost-exporter-core
│   └── src/
│       ├── types/
│       │   ├── domain.ts        # CostSpan, AggregationKey, PriceEntry
│       │   └── schemas.ts       # Zod validation schemas
│       ├── semconv/
│       │   ├── attributes.ts    # GenAI semantic convention attribute name constants
│       │   └── version.ts       # Pinned semconv version
│       ├── utils/
│       │   ├── logger.ts        # Pino logger setup
│       │   └── interval.ts      # Interval utilities
│       └── constants.ts
├── pricing/                     # @reaatech/otel-cost-exporter-pricing
│   ├── src/
│   │   ├── types.ts             # Pricing provider interface
│   │   ├── table.ts             # In-memory pricing table
│   │   └── loader.ts            # YAML file loader
│   └── pricing-tables/          # Bundled YAML files (shipped with npm)
│       ├── openai.yaml
│       ├── anthropic.yaml
│       ├── google.yaml
│       ├── aws-bedrock.yaml
│       └── azure.yaml
├── calculator/                  # @reaatech/otel-cost-exporter-calculator
│   └── src/
│       ├── calculator.ts        # Token → USD conversion
│       ├── normalizer.ts        # Model name normalization
│       ├── cache.ts             # Pricing lookup cache
│       └── cost-calculator.ts   # Cost calculation engine
├── exporter/                    # @reaatech/otel-cost-exporter
│   └── src/
│       ├── config/              # Configuration management
│       ├── processor/           # Span processor (shared kernel)
│       ├── metrics/             # Metric definitions and builders
│       ├── exporters/           # Prometheus, OTLP, JSON
│       ├── otel/                # OpenTelemetry integration
│       └── collector/           # OTel Collector processor plugin
├── cli/                         # @reaatech/otel-cost-exporter-cli
│   └── src/
│       ├── cli.ts               # CLI entry point
│       └── commands/            # CLI subcommands

tests/
└── fixtures/                    # Test fixtures (spans, configs)
```

## Architectural Patterns

### 1. Dependency Injection

Use constructor injection via factory functions:

```typescript
export interface CostCalculatorDeps {
  readonly pricing: PricingProvider;
  readonly cache: PricingCache;
  readonly logger: PinoLogger;
}

export function createCostCalculator(deps: CostCalculatorDeps): CostCalculator {
  return {
    calculate(model: string, inputTokens: number, outputTokens: number): CostBreakdown {
      deps.logger.debug({ model, inputTokens, outputTokens }, 'Calculating cost');

      const entry = deps.cache.get(model) ?? deps.pricing.getPrice(model);
      if (!entry) {
        deps.logger.warn({ model }, 'Model not found in pricing table');
        throw new PricingError(`Unknown model: ${model}`, 'MODEL_NOT_FOUND');
      }

      deps.cache.set(model, entry);
      return calculateCost(entry, inputTokens, outputTokens);
    },
  };
}
```

### 2. Factory Pattern

```typescript
export interface ProcessorFactory {
  createProcessor(): Promise<SpanProcessor>;
}

export function createProcessorFactory(config: Config): ProcessorFactory {
  return {
    async createProcessor(): Promise<SpanProcessor> {
      const pricing = await createPricingProvider(config.pricing);
      const cache = createPricingCache(config.cache);
      const calculator = createCostCalculator({ pricing, cache, logger });
      return createSpanProcessor({ calculator, config });
    },
  };
}
```

### 3. Options / Builder Pattern

```typescript
export interface ExporterOptions {
  readonly format: ExportFormat;
  readonly labels: Readonly<Record<string, string>>;
}

export function createExporter(options: Partial<ExporterOptions> = {}): MetricsExporter {
  const resolved: ExporterOptions = {
    format: options.format ?? 'prometheus',
    labels: { ...DEFAULT_LABELS, ...options.labels },
  };

  const exporters: Record<ExportFormat, MetricsExporter> = {
    prometheus: createPrometheusExporter(resolved),
    otlp: createOtlpExporter(resolved),
    json: createJsonExporter(resolved),
  };

  return exporters[resolved.format];
}
```

### 4. Middleware / Chain of Responsibility

```typescript
export type SpanMiddleware = (next: SpanProcessor) => SpanProcessor;

export function loggingMiddleware(logger: PinoLogger): SpanMiddleware {
  return (next: SpanProcessor): SpanProcessor => ({
    async processSpans(spans: ReadonlyArray<Span>): Promise<void> {
      logger.info({ count: spans.length }, 'Processing spans');
      const start = performance.now();
      await next.processSpans(spans);
      logger.info({ durationMs: performance.now() - start }, 'Processed spans');
    },
  });
}

export function applyMiddleware(
  processor: SpanProcessor,
  middlewares: readonly SpanMiddleware[],
): SpanProcessor {
  return middlewares.reduceRight((acc, mw) => mw(acc), processor);
}
```

### 5. Concurrency Patterns

```typescript
// 1. EventEmitter for async span processing
import { EventEmitter } from 'node:events';

export class SpanProcessor extends EventEmitter {
  private readonly pending = new Set<Promise<void>>();

  async processSpans(spans: readonly Span[]): Promise<void> {
    const tasks = spans.map((span) => this.processOne(span));
    await Promise.allSettled(tasks);
  }

  private async processOne(span: Span): Promise<void> {
    // Lock-free: each span is independent
  }
}

// 2. LRU Cache with max size
export class PricingCache {
  private readonly cache = new Map<string, PriceEntry>();
  private readonly accessOrder: string[] = [];

  constructor(private readonly maxSize: number = 1000) {}

  get(model: string): PriceEntry | undefined {
    const entry = this.cache.get(model);
    if (entry) {
      this.touch(model);
    }
    return entry;
  }

  set(model: string, entry: PriceEntry): void {
    if (this.cache.has(model)) {
      this.touch(model);
    } else {
      this.evictIfNeeded();
      this.cache.set(model, entry);
      this.accessOrder.push(model);
    }
  }

  private touch(model: string): void {
    const idx = this.accessOrder.indexOf(model);
    if (idx > -1) {
      this.accessOrder.splice(idx, 1);
      this.accessOrder.push(model);
    }
  }

  private evictIfNeeded(): void {
    while (this.cache.size >= this.maxSize) {
      const lru = this.accessOrder.shift();
      if (lru) this.cache.delete(lru);
    }
  }
}

// 3. Atomic config swap
export class ConfigService {
  private config: Config;

  constructor(initial: Config) {
    this.config = initial;
  }

  getSnapshot(): Config {
    return this.config; // Object reference swap is atomic in JS
  }

  async reload(): Promise<void> {
    const next = await loadConfig();
    this.config = next;
  }
}
```

## Testing Requirements

### Testing Framework

Vitest 3+ with `@vitest/coverage-v8`. Use:
- `describe`/`it` blocks for test organization
- `expect` assertions (Jest-compatible)
- `vi.fn()` for mocks and spies
- `vi.mock()` for module-level mocking

### Unit Test Structure

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCostCalculator } from '@reaatech/otel-cost-exporter-calculator';
import type { CostCalculatorDeps } from '@reaatech/otel-cost-exporter-calculator';

describe('calculateCost', () => {
  let calculator: ReturnType<typeof createCostCalculator>;
  let mockPricing: { getPrice: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockPricing = {
      getPrice: vi.fn(),
    };

    calculator = createCostCalculator({
      pricing: mockPricing as any,
      cache: { get: vi.fn(), set: vi.fn() },
      logger: { debug: vi.fn(), warn: vi.fn() } as any,
    });
  });

  type TestCase = {
    name: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    expectedInput: number;
    expectedOutput: number;
    expectedTotal: number;
    expectError?: string;
  };

  const testCases: TestCase[] = [
    {
      name: 'GPT-4 standard calculation',
      model: 'gpt-4',
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      expectedInput: 30.0,
      expectedOutput: 30.0,
      expectedTotal: 60.0,
    },
    {
      name: 'handles zero tokens',
      model: 'gpt-3.5-turbo',
      inputTokens: 0,
      outputTokens: 0,
      expectedInput: 0,
      expectedOutput: 0,
      expectedTotal: 0,
    },
    {
      name: 'throws on unknown model',
      model: 'unknown-model',
      inputTokens: 1000,
      outputTokens: 500,
      expectedInput: 0,
      expectedOutput: 0,
      expectedTotal: 0,
      expectError: 'MODEL_NOT_FOUND',
    },
  ];

  it.each(testCases)('$name', (tc) => {
    if (tc.expectError) {
      mockPricing.getPrice.mockReturnValue(null);
      expect(() => calculator.calculate(tc.model, tc.inputTokens, tc.outputTokens)).toThrow(
        tc.expectError,
      );
      return;
    }

    mockPricing.getPrice.mockReturnValue({
      inputTokenPrice: 30.0,
      outputTokenPrice: 60.0,
      effectiveDate: '2024-01-01',
    });

    const result = calculator.calculate('gpt-4', 1_000_000, 500_000);
    expect(result.inputCost).toBeCloseTo(30.0, 4);
    expect(result.outputCost).toBeCloseTo(30.0, 4);
    expect(result.totalCost).toBeCloseTo(60.0, 4);
  });
});
```

### Test Coverage Requirements

| Component | Minimum Coverage |
|-----------|-----------------|
| Core calculation | **95%** |
| Pricing tables | **90%** |
| Configuration | **85%** |
| Exporters | **85%** |
| Overall | **> 85%** |

Coverage thresholds are enforced in each package's `vitest.config.ts` with watermarks at 70%/85%.

### Benchmark Tests

```typescript
import { bench, describe } from 'vitest';
import { createCostCalculator } from '@reaatech/otel-cost-exporter-calculator';

describe('CostCalculator benchmarks', () => {
  const pricing = createMockPricingProvider();
  const calculator = createCostCalculator({ pricing, cache: createCache(), logger });

  bench('single cost calculation', () => {
    calculator.calculate('gpt-4', 1_000_000, 500_000);
  });

  bench('batch of 100 calculations', () => {
    for (let i = 0; i < 100; i++) {
      calculator.calculate('gpt-4', 1_000_000, 500_000);
    }
  });
});
```

## Common Tasks

### Adding a New Provider

1. Create pricing table in `packages/pricing/pricing-tables/`
2. Add model normalization rules in `packages/calculator/src/normalizer.ts`
3. Add provider to `gen_ai.system` mapping
4. Add tests for new provider
5. Update documentation

### Updating Pricing Tables

1. Run pricing update script: `pnpm generate-pricing`
2. Review changes in PR
3. Run tests: `pnpm test`
4. Validate: `pnpm validate-pricing`

### Adding New Metrics

1. Define metric in `packages/exporter/src/metrics/definitions.ts`
2. Add to metrics builder
3. Update export formats
4. Add tests and documentation

## Debugging Guide

### Enable Debug Logging

```yaml
logging:
  level: debug
  format: json
```

### Inspect Span Processing

```bash
# Run with debug output
pnpm dev -- --debug

# View processing logs
kubectl logs -f deployment/otel-cost-exporter | jq 'select(.level==30)'
```

### Test Pricing Lookup

```bash
# Test pricing for specific model
curl -X POST http://localhost:8888/debug/pricing \
  -H 'Content-Type: application/json' \
  -d '{"model": "gpt-4", "input_tokens": 1000000, "output_tokens": 500000}'
```

## Performance Guidelines

### Memory Usage

- Keep allocations minimal in hot paths
- Use object pools for frequently allocated objects
- Set appropriate cache sizes (default: 1000 entries)
- Prefer `Map` over `Object` for dynamic key-value stores

### CPU Usage

- Batch process spans when possible
- Use `Promise.allSettled` for concurrent span processing
- Cache pricing lookups aggressively
- Avoid synchronous operations in event loop

### Network Usage

- Batch exports when possible
- Use compression for large exports
- Set appropriate timeouts with AbortController

## Security Guidelines

### Data Handling

- **Never** log LLM content or prompts
- **Never** store PII in metrics or logs
- **Always** validate and sanitize configuration inputs
- **Always** run `pnpm audit --audit-level=high` before releases

### Pricing Table Security

- Load bundled tables from read-only filesystem
- Validate all external data with Zod schemas
- Use HTTPS for all remote fetches

### Access Control

- Validate all configuration values with Zod
- Set resource limits (memory, CPU) in deployment config
- Run as non-root in containers
- Use read-only filesystem where possible

## CI/CD Integration

### Pre-commit Checks

```bash
pnpm typecheck    # tsc --noEmit -p tsconfig.typecheck.json
pnpm lint         # biome check .
pnpm format       # biome format --write .
pnpm test         # vitest run (all packages via turbo)
```

### Pull Request Requirements

- [ ] All tests passing (including coverage >= 85%)
- [ ] No linting errors (`pnpm lint`)
- [ ] TypeScript compiles clean (`pnpm typecheck`)
- [ ] No security vulnerabilities (`pnpm audit --audit-level=high`)
- [ ] Documentation updated (CHANGELOG, README if needed)
- [ ] Biome formatting applied (`pnpm format`)

### Release Checklist

- [ ] Run `pnpm changeset` to record changes
- [ ] Merge to main — CI opens "Version Packages" PR
- [ ] Review version bumps and auto-generated CHANGELOGs
- [ ] Merge the Version Packages PR — CI publishes to npm + GitHub Packages

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Unknown model errors | Model not in pricing table | Add model to pricing table or set default price |
| High memory usage | Cache too large | Reduce `cache.maxSize` in config |
| Export failures | Network issues | Check connectivity, increase retry count |
| Slow processing | No batching | Enable batch processing in config |
| TypeScript errors in node_modules | Dep mismatch | Run `pnpm install --frozen-lockfile` |
| Workspace package not found | Missing build | Run `pnpm build` to compile all workspace packages |
| Import resolution failure | Missing `exports` map | Verify each package's `package.json` exports field |
| Turborepo cache miss | Changed inputs | Run `pnpm test --force` to bypass cache if needed |

### Getting Help

1. Check the [troubleshooting guide](skills/troubleshooting.md)
2. Search existing GitHub issues
3. Open a new issue with detailed information

## Agent Skill Files

### pricing-update.md
Procedures for updating pricing tables: automated and manual workflows, validation steps, rollback procedures.

### model-addition.md
Guide for adding new LLM model support: provider integration, model normalization, pricing configuration, testing requirements.

### troubleshooting.md
Comprehensive troubleshooting guide: common errors, debug procedures, performance tuning, recovery procedures.

### release-procedure.md
Release and deployment procedures: version management, build, deploy, post-release verification, rollback.

### security-review.md
Security review checklist: code security, dependency scanning, configuration hardening, deployment security.

### npm-workflow.md
pnpm/npm workflows: dependency management, publishing, lockfile handling, version bumping, security auditing.

### code-review.md
Code review checklist: security, correctness, performance, testing, code quality, documentation, OTel conventions, anti-patterns.

### docs-maintenance.md
Documentation standards: doc file responsibilities, README/ARCHITECTURE/CHANGELOG/JSDoc standards, review checklist.
