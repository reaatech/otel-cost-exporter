import path from 'node:path';
import type {
  CostCalculator,
  CostResult,
  ModelNormalizer,
  PricingCache,
} from '@reaatech/otel-cost-exporter-calculator';
import {
  createCostCalculator,
  createModelNormalizer,
  createPricingCache,
} from '@reaatech/otel-cost-exporter-calculator';
import type { PricingTable } from '@reaatech/otel-cost-exporter-pricing';
import { createPricingTable, loadPricingData } from '@reaatech/otel-cost-exporter-pricing';
import { beforeEach, describe, expect, it } from 'vitest';

const TABLES_DIR = path.resolve(import.meta.dirname, '../../../pricing/pricing-tables');

describe('createCostCalculator', () => {
  let calculator: CostCalculator;
  let cache: PricingCache;
  let pricingTable: PricingTable;
  let normalizer: ModelNormalizer;

  beforeEach(async () => {
    const data = await loadPricingData({ tablesDir: TABLES_DIR });
    pricingTable = createPricingTable(data);
    cache = createPricingCache();
    normalizer = createModelNormalizer();
    calculator = createCostCalculator({
      pricing: pricingTable,
      cache,
      normalizer,
    });
  });

  it('should calculate GPT-4 cost for 1M input + 500K output tokens', () => {
    const result: CostResult = calculator.calculate('gpt-4', 1_000_000, 500_000, {
      provider: 'openai',
    });

    expect(result.model).toBe('gpt-4');
    expect(result.provider).toBe('openai');
    expect(result.inputCostUsd).toBeCloseTo(30.0, 6);
    expect(result.outputCostUsd).toBeCloseTo(30.0, 6);
    expect(result.totalCostUsd).toBeCloseTo(60.0, 6);
    expect(result.cacheReadCostUsd).toBe(0);
    expect(result.cacheCreationCostUsd).toBe(0);
  });

  it('should calculate Claude Opus cost with cache tokens', () => {
    const result: CostResult = calculator.calculate('claude-3-opus-20240229', 1_000_000, 500_000, {
      provider: 'anthropic',
      cacheReadTokens: 200_000,
      cacheCreationTokens: 100_000,
    });

    expect(result.model).toBe('claude-3-opus-20240229');
    expect(result.provider).toBe('anthropic');
    expect(result.inputCostUsd).toBeCloseTo(12.0, 6);
    expect(result.outputCostUsd).toBeCloseTo(37.5, 6);
    expect(result.cacheReadCostUsd).toBeCloseTo(0.3, 6);
    expect(result.cacheCreationCostUsd).toBeCloseTo(1.875, 6);
    expect(result.totalCostUsd).toBeCloseTo(51.675, 6);
  });

  it('should calculate Gemini Pro cost via alias resolution', () => {
    const result: CostResult = calculator.calculate('gemini-pro', 1_000_000, 500_000, {
      provider: 'google_genai',
    });

    expect(result.provider).toBe('google');
    expect(result.model).toBe('gemini-1.5-pro');
    expect(result.inputCostUsd).toBeCloseTo(3.5, 6);
    expect(result.outputCostUsd).toBeCloseTo(5.25, 6);
    expect(result.totalCostUsd).toBeCloseTo(8.75, 6);
  });

  it('should use default price when model is unknown and defaultPrice is set', () => {
    const defaultCalc = createCostCalculator({
      pricing: pricingTable,
      cache,
      normalizer,
      defaultPrice: 0.001,
    });

    const result: CostResult = defaultCalc.calculate(
      'totally-unknown-model-xyz',
      1_000_000,
      500_000,
    );

    expect(result.model).toBe('totally-unknown-model-xyz');
    expect(result.provider).toBe('unknown');
    expect(result.inputCostUsd).toBeCloseTo(0.001, 6);
    expect(result.outputCostUsd).toBeCloseTo(0.0005, 6);
    expect(result.totalCostUsd).toBeCloseTo(0.0015, 6);
  });

  it('should throw MODEL_NOT_FOUND when model is unknown and no defaultPrice is set', () => {
    expect(() => {
      calculator.calculate('totally-unknown-model-xyz', 1000, 500);
    }).toThrow('Unknown model: totally-unknown-model-xyz');
  });

  it('should throw INVALID_PRICE for negative input tokens', () => {
    expect(() => {
      calculator.calculate('gpt-4', -1, 500, { provider: 'openai' });
    }).toThrow('Token counts must be non-negative');
  });

  it('should throw INVALID_PRICE for negative output tokens', () => {
    expect(() => {
      calculator.calculate('gpt-4', 100, -500, { provider: 'openai' });
    }).toThrow('Token counts must be non-negative');
  });

  it('should return zero costs for zero tokens', () => {
    const result: CostResult = calculator.calculate('gpt-4', 0, 0, {
      provider: 'openai',
    });

    expect(result.inputCostUsd).toBe(0);
    expect(result.outputCostUsd).toBe(0);
    expect(result.totalCostUsd).toBe(0);
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
  });

  it('should use cached entry on subsequent calls (verify via cache stats)', () => {
    const firstResult: CostResult = calculator.calculate('gpt-4', 1_000_000, 500_000, {
      provider: 'openai',
    });
    expect(firstResult.totalCostUsd).toBeCloseTo(60.0, 6);

    const afterFirst = cache.stats();
    expect(afterFirst.hits).toBe(0);
    expect(afterFirst.misses).toBe(1);

    const secondResult: CostResult = calculator.calculate('gpt-4', 1_000_000, 500_000, {
      provider: 'openai',
    });
    expect(secondResult.totalCostUsd).toBeCloseTo(60.0, 6);

    const afterSecond = cache.stats();
    expect(afterSecond.hits).toBe(1);
    expect(afterSecond.misses).toBe(1);
    expect(afterSecond.hitRate).toBeCloseTo(0.5, 4);
  });

  it('should resolve aliases end-to-end through model normalization', () => {
    const result: CostResult = calculator.calculate('gpt4', 1_000_000, 500_000, {
      provider: 'openai',
    });

    expect(result.model).toBe('gpt-4');
    expect(result.provider).toBe('openai');
    expect(result.inputCostUsd).toBeCloseTo(30.0, 6);
    expect(result.outputCostUsd).toBeCloseTo(30.0, 6);
    expect(result.totalCostUsd).toBeCloseTo(60.0, 6);
  });

  it('should detect provider from model name when no provider arg is supplied', () => {
    const result: CostResult = calculator.calculate('gpt-4', 1_000_000, 500_000);

    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-4');
    expect(result.inputCostUsd).toBeCloseTo(30.0, 6);
    expect(result.outputCostUsd).toBeCloseTo(30.0, 6);
    expect(result.totalCostUsd).toBeCloseTo(60.0, 6);
  });

  it('should use default price when normalizer resolves model but pricing table has no entry', () => {
    const defaultCalc = createCostCalculator({
      pricing: {
        getPrice: () => null,
      },
      cache,
      normalizer,
      defaultPrice: 0.005,
    });

    const result: CostResult = defaultCalc.calculate('claude-3-opus-20240229', 1_000_000, 500_000, {
      provider: 'anthropic',
    });

    expect(result.model).toBe('claude-3-opus-20240229');
    expect(result.provider).toBe('anthropic');
    expect(result.inputCostUsd).toBeCloseTo(0.005, 6);
    expect(result.outputCostUsd).toBeCloseTo(0.0025, 6);
    expect(result.totalCostUsd).toBeCloseTo(0.0075, 6);
  });

  it('should throw MODEL_NOT_FOUND when normalizer resolves model but pricing table has no entry and no defaultPrice', () => {
    const noDefaultCalc = createCostCalculator({
      pricing: {
        getPrice: () => null,
      },
      cache: createPricingCache(),
      normalizer,
    });

    expect(() => {
      noDefaultCalc.calculate('claude-3-opus-20240229', 1000, 500, {
        provider: 'anthropic',
      });
    }).toThrow('Model not found in pricing table');
  });

  it('should use canonical name from normalizer for pricing lookup when suffix is stripped', () => {
    const result: CostResult = calculator.calculate(
      'claude-3-opus-20240229-v1',
      1_000_000,
      500_000,
      { provider: 'anthropic' },
    );

    expect(result.model).toBe('claude-3-opus-20240229');
    expect(result.provider).toBe('anthropic');
    expect(result.inputCostUsd).toBeCloseTo(15.0, 6);
    expect(result.outputCostUsd).toBeCloseTo(37.5, 6);
  });

  it('should resolve claude-sonnet alias to claude-3-5-sonnet-20241022', () => {
    const result: CostResult = calculator.calculate('claude-sonnet', 1_000_000, 500_000, {
      provider: 'anthropic',
    });

    expect(result.model).toBe('claude-3-5-sonnet-20241022');
    expect(result.provider).toBe('anthropic');
    expect(result.inputCostUsd).toBeCloseTo(3.0, 6);
    expect(result.outputCostUsd).toBeCloseTo(7.5, 6);
    expect(result.totalCostUsd).toBeCloseTo(10.5, 6);
  });
});
