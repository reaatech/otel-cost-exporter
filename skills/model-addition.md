# Skill: Adding New LLM Models/Providers

<!--
  Implementation Status: ACTIVE
  Target Phase: 3-4 (Integration / Production Readiness)
  Prerequisites: Phase 1 (Foundation), Phase 2 (Core Implementation)
  Note: When detecting providers, use gen_ai.system as the primary signal.
        Fall back to model name pattern matching only when gen_ai.system is absent.
        The actual provider detection uses Map<string, string> for SYSTEM_PROVIDERS
        and a detectProviderFromName() function with inline regex tests.
-->

## Overview

This skill provides a step-by-step guide for adding support for new LLM models or providers to the otel-cost-exporter system. This includes integrating new providers, configuring pricing, and ensuring proper model name normalization.

## When to Add a New Model/Provider

- **New Provider Integration**: Adding support for a completely new LLM provider (e.g., Cohere, Together AI)
- **New Model Release**: Provider releases a new model variant
- **Model Variant Support**: Supporting region-specific or fine-tuned model variants
- **Open Source Model**: Adding support for popular open-source models

## Preparation

### Information Gathering

Before adding a new model/provider, collect:

1. **Model Identification**
   - Official model name/ID
   - Common aliases and variations
   - Provider name

2. **Pricing Information**
   - Input token price (per 1M tokens in USD)
   - Output token price (per 1M tokens in USD)
   - Effective date of pricing
   - Pricing URL/source

3. **Technical Details**
   - API endpoint patterns
   - Model capability flags (context window, etc.)
   - Provider-specific attributes

### Checklist

- [ ] Official pricing information obtained
- [ ] Model name and aliases documented
- [ ] Provider detection pattern defined
- [ ] Test cases prepared
- [ ] Documentation updated

## Step-by-Step Procedure

### Step 1: Create Pricing Table Entry

1. **Locate or create provider pricing file**
   ```bash
   # Check if provider file exists
   ls packages/pricing/pricing-tables/

   # If new provider, create new file
   touch packages/pricing/pricing-tables/new-provider.yaml
   ```

2. **Add model pricing**
   ```yaml
   # packages/pricing/pricing-tables/new-provider.yaml
   version: "2024.01"
   last_updated: "2024-01-15T00:00:00Z"
   pricing_unit: 1_000_000  # all prices per 1M tokens

   providers:
     new-provider:
       display_name: "New Provider"
       website: "https://newprovider.com"
       models:
         new-model-large:
           input_token_price: 10.0       # $10 per 1M input tokens
           output_token_price: 30.0      # $30 per 1M output tokens
           effective_date: "2024-01-01"
           context_window: 128000
         new-model-small:
           input_token_price: 1.0
           output_token_price: 3.0
           effective_date: "2024-01-01"
           context_window: 32000
   ```

### Step 2: Add Model Normalization Rules

Provider detection should rely on `gen_ai.system` as the primary signal. Model name pattern matching from `gen_ai.request.model` is a fallback.

 1. **Edit normalizer configuration**
    ```typescript
    // packages/calculator/src/normalizer.ts

    /**
     * Maps gen_ai.system values to canonical provider keys.
     * This is the primary signal for provider detection.
     */
    const SYSTEM_PROVIDERS = new Map<string, string>([
      // ... existing entries
      ['new-provider', 'new-provider'],
    ]);

    /**
     * Known provider prefixes to strip from model names.
     */
    const KNOWN_PREFIXES = [
      // ... existing entries
      'new-provider',
    ];

    /**
     * Fallback provider detection from model name patterns.
     */
    function detectProviderFromName(name: string): string | null {
      // Add new pattern:
      if (/^new-model-/.test(name)) return 'new-provider';
      // ... existing patterns
      return null;
    }
    ```

 2. **Add model aliases**
    ```typescript
    // packages/calculator/src/normalizer.ts

    const DEFAULT_ALIASES = new Map<string, string>([
      // ... existing aliases
      ['new-model-large', 'new-model-large'],
      ['newmodel', 'new-model-large'],
    ]);

    export function createModelNormalizer(): ModelNormalizer {
      const aliases = new Map(DEFAULT_ALIASES);
      // ... rest of factory
    }
    ```

### Step 3: Register Provider Pricing

The pricing system uses a factory pattern with YAML-based pricing tables:

1. **Pricing is YAML-based**: Create a `packages/pricing/pricing-tables/new-provider.yaml` file
2. **PricingTable loads all YAML files**: No registry pattern needed — the `loadPricingData()` function loads all tables from `packages/pricing/pricing-tables/` directory
3. **Wildcard support**: The `PricingTable` supports wildcard patterns in model names (e.g., `new-model-*` matches all variants)

```typescript
// The PricingTable is created via factory:
// packages/pricing/src/table.ts
export function createPricingTable(data: PricingTableData): PricingTable {
  // Returns an immutable-style table with getPrice(), supports(), getAllModels()
}

// Adding a new provider just means adding a YAML file.
// The loader picks it up automatically from packages/pricing/pricing-tables/
```

### Step 4: Add Unit Tests

 1. **Create pricing tests**
    ```typescript
    // packages/pricing/src/__tests__/new-provider.test.ts

    import { describe, it, expect } from 'vitest';
    import { calculateCost, type PriceEntry } from '@opencost/calculator';
    import { loadPricingData } from '@opencost/pricing';
    import { createPricingTable } from '@opencost/pricing';
    import path from 'node:path';

    describe('NewProvider pricing', () => {
      it('should load new-provider pricing table', async () => {
        const data = await loadPricingData({
          tablesDir: path.resolve(import.meta.dirname, '../pricing-tables'),
        });
        const table = createPricingTable(data);

        const entry = table.getPrice('new-model-large', 'new-provider');
        expect(entry).not.toBeNull();
        expect(entry!.inputTokenPrice).toBe(10.0);
        expect(entry!.outputTokenPrice).toBe(30.0);
      });
    });
    ```

 2. **Create normalizer tests**
    ```typescript
    // packages/calculator/src/__tests__/normalizer.test.ts (extend existing)

    import { describe, it, expect, beforeEach } from 'vitest';
    import { createModelNormalizer } from '@opencost/calculator';
    import type { ModelNormalizer } from '@opencost/calculator';

    describe('normalize with new provider', () => {
      let normalizer: ModelNormalizer;

      beforeEach(() => {
        normalizer = createModelNormalizer();
      });

      it('should resolve new-provider system to new-provider', () => {
        const result = normalizer.normalize('new-model-large', 'new-provider');
        expect(result!.provider).toBe('new-provider');
        expect(result!.canonicalName).toBe('new-model-large');
      });

      it('should strip ft: prefix from new-provider models', () => {
        const result = normalizer.normalize('ft:new-model-large', 'new-provider');
        expect(result!.canonicalName).toBe('new-model-large');
      });
    });
    ```

### Step 5: Add Integration Tests

```typescript
// packages/exporter/src/__tests__/pipeline.test.ts (extend existing)

describe('new provider pipeline', () => {
  it('should process new-provider span through full pipeline', () => {
    // Wire up pricing table → normalizer → calculator → processor
    // Verify cost breakdown matches expected pricing
  });
});
```

### Step 6: Update Documentation

### Step 7: Run Tests and Validation

```bash
# Run all tests
pnpm test

# Run specific new provider unit tests
pnpm vitest run packages/pricing/src/__tests__/new-provider
pnpm vitest run packages/calculator/src/__tests__/normalizer

# Run integration tests
pnpm vitest run packages/exporter/src/__tests__/new-provider

# Run with coverage
pnpm test:coverage

# Type-check all code
pnpm typecheck

# Lint
pnpm lint

# Validate pricing tables
pnpm validate-pricing
```

### Step 8: Create Pull Request

```bash
# Create feature branch
git checkout -b feature/add-new-provider

# Create a changeset
pnpm changeset

# Commit changes
git add packages/pricing/pricing-tables/new-provider.yaml
git add packages/calculator/src/normalizer.ts
git add packages/pricing/src/__tests__/new-provider.test.ts
git add packages/calculator/src/__tests__/normalizer.test.ts
git add docs/supported-models.md

git commit -m "feat: add support for New Provider models

- Added pricing table for new-provider
- Added model normalization rules
- Added unit and integration tests
- Updated documentation

Supported models:
- new-model-large (128K context)
- new-model-small (32K context)

Closes #123"

git push origin feature/add-new-provider
```

## Model Name Normalization Patterns

### Common Patterns to Handle

| Pattern | Example Input | Normalized Output |
|---------|---------------|-------------------|
| Provider prefix | `new-provider/model` | `new-provider/model` |
| No prefix | `model` | `new-provider/model` |
| Alias | `newmodel` | `new-provider/model` |
| Version suffix | `model-v1` | `new-provider/model` |
| Region suffix | `model-us` | `new-provider/model` |
| Fine-tuned | `ft:model-v1` | `new-provider/model` |

### Normalization Rules

```typescript
// packages/calculator/src/normalizer.ts

export interface NormalizationRule {
  /** Regular expression to match against raw model names */
  readonly pattern: RegExp;

  /** Provider key assigned when this rule matches */
  readonly provider: string;

  /** Canonical model name (may include capture group references like $1) */
  readonly canonical: string;

  /** Priority — lower numbers are evaluated first (higher priority) */
  readonly priority: number;
}

/**
 * Ordered list of normalization rules.
 * Rules are evaluated in priority order (lowest number first).
 * The first matching rule wins.
 */
export const normalizationRules: readonly NormalizationRule[] = [
  // Exact matches (highest priority)
  {
    pattern: /^exact:new-model-large$/,
    provider: 'new-provider',
    canonical: 'new-provider/new-model-large',
    priority: 1,
  },
  // Prefix-based matches
  {
    pattern: /^newmodel-(large|small)$/,
    provider: 'new-provider',
    canonical: 'new-provider/$1',
    priority: 2,
  },
  // Fallback: anything already prefixed with the provider key
  {
    pattern: /^new-provider\/(.+)$/,
    provider: 'new-provider',
    canonical: 'new-provider/$1',
    priority: 10,
  },
];
```

## Testing Strategy

### Unit Tests
- Test pricing lookup for each model
- Test cost calculation with various token counts (including zero and boundary values)
- Test model name normalization against all known aliases and edge cases
- Test error handling for unknown models and invalid inputs

### Integration Tests
- Test full span processing pipeline from raw span to cost metrics
- Test with different export formats (Prometheus, OTLP, JSON)
- Test label generation matches expected keys and values
- Test aggregation behavior across multiple spans

### End-to-End Tests
- Test with a real OpenTelemetry Collector instance
- Test Prometheus scrape endpoint returns valid metric families
- Test OTLP export to a collector or backend
- Test configuration overrides via YAML and environment variables

## Common Issues and Solutions

### Issue: Model not recognized

**Symptoms**: "unknown model" errors in logs

**Solution**:
1. Check model name in span attributes
2. Verify normalization rules cover the raw model name
3. Add alias to `modelAliases` if needed
4. Confirm pricing table entry exists for the canonical name

### Issue: Incorrect cost calculation

**Symptoms**: Costs don't match expected values

**Solution**:
1. Verify pricing table values match the official provider pricing page
2. Check token count extraction from span attributes (`gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`)
3. Verify the `calculateCost` formula — costs are `(tokens / 1_000_000) * pricePerMillion`
4. Test with known input/output values and compare against a manual calculation

### Issue: Provider detection fails

**Symptoms**: Model assigned to wrong provider

**Solution**:
1. Review provider detection: `gen_ai.system` takes precedence over pattern matching
2. Check `systemProviders` mapping for the expected `gen_ai.system` value
3. Verify `normalizationRules` priority order — lower numbers win
4. Add more specific patterns at higher priority for ambiguous model names

## Best Practices

1. **Use canonical model names** — Always use `provider/model` format internally
2. **Handle aliases gracefully** — Support common variations and old naming schemes
3. **Document pricing sources** — Include URL and effective date in the YAML table
4. **Test edge cases** — Unknown models, missing tokens, zero tokens, negative tokens
5. **Keep pricing tables updated** — Regular sync with provider pricing pages
6. **Monitor for errors** — Set up alerts for `MODEL_NOT_FOUND` errors in production
7. **Version your changes** — Use changesets for versioning pricing table updates

## Provider-Specific Considerations

### OpenAI
- Handle `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo` variants
- Support fine-tuned model naming (`ft:` prefix)
- Consider regional pricing differences

### Anthropic
- Handle Claude model versions (claude-3-opus, claude-3-sonnet, etc.)
- Support beta model identifiers
- Consider context window variations

### Google
- Handle Gemini model variants
- Support Vertex AI model naming
- Consider region-specific models

### AWS Bedrock
- Handle multiple provider models (Claude, Llama, Titan)
- Support provisioned throughput pricing
- Consider region-specific pricing

### Azure OpenAI
- Handle Azure deployment names
- Support custom deployment names
- Consider regional pricing differences
