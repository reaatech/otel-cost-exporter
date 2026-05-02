import { calculateCost } from '@reaatech/otel-cost-exporter-calculator';
import type { PriceEntry } from '@reaatech/otel-cost-exporter-core';
import { describe, expect, it } from 'vitest';

describe('calculateCost', () => {
  const gpt4Entry: PriceEntry = {
    inputTokenPrice: 30.0,
    outputTokenPrice: 60.0,
    effectiveDate: '2024-01-01',
  };

  it('should compute GPT-4 cost for standard token counts', () => {
    const result = calculateCost(gpt4Entry, 1_000_000, 500_000);
    expect(result.inputCostUsd).toBeCloseTo(30.0, 4);
    expect(result.outputCostUsd).toBeCloseTo(30.0, 4);
  });

  it('should handle zero tokens', () => {
    const result = calculateCost(gpt4Entry, 0, 0);
    expect(result.inputCostUsd).toBe(0);
    expect(result.outputCostUsd).toBe(0);
  });

  it('should handle zero input tokens with positive output tokens', () => {
    const result = calculateCost(gpt4Entry, 0, 500_000);
    expect(result.inputCostUsd).toBe(0);
    expect(result.outputCostUsd).toBeCloseTo(30.0, 4);
  });

  it('should handle positive input tokens with zero output tokens', () => {
    const result = calculateCost(gpt4Entry, 1_000_000, 0);
    expect(result.inputCostUsd).toBeCloseTo(30.0, 4);
    expect(result.outputCostUsd).toBe(0);
  });

  it('should handle Anthropic cache-aware pricing', () => {
    const claudeEntry: PriceEntry = {
      inputTokenPrice: 15.0,
      outputTokenPrice: 75.0,
      cacheReadPrice: 1.5,
      cacheCreationPrice: 18.75,
      effectiveDate: '2024-03-04',
    };

    const result = calculateCost(claudeEntry, 1_000_000, 500_000, 200_000, 100_000);
    expect(result.cacheReadCostUsd).toBeCloseTo(0.3, 4);
    expect(result.cacheCreationCostUsd).toBeCloseTo(1.875, 4);
  });

  it('should handle cache-only model (all input tokens cached)', () => {
    const claudeEntry: PriceEntry = {
      inputTokenPrice: 15.0,
      outputTokenPrice: 75.0,
      cacheReadPrice: 1.5,
      effectiveDate: '2024-03-04',
    };
    const result = calculateCost(claudeEntry, 1_000_000, 0, 1_200_000);
    expect(result.inputCostUsd).toBe(0);
    expect(result.outputCostUsd).toBe(0);
    expect(result.cacheReadCostUsd).toBeCloseTo(1.8, 4);
  });

  it('should handle fractional token counts', () => {
    const result = calculateCost(gpt4Entry, 150, 45);
    expect(result.inputCostUsd).toBeCloseTo(0.0045, 6);
    expect(result.outputCostUsd).toBeCloseTo(0.0027, 6);
  });

  it('should handle very small token counts', () => {
    const result = calculateCost(gpt4Entry, 1, 1);
    expect(result.inputCostUsd).toBeCloseTo(0.00003, 6);
    expect(result.outputCostUsd).toBeCloseTo(0.00006, 6);
  });

  it('should handle large token counts', () => {
    const result = calculateCost(gpt4Entry, 10_000_000, 5_000_000);
    expect(result.inputCostUsd).toBeCloseTo(300.0, 4);
    expect(result.outputCostUsd).toBeCloseTo(300.0, 4);
  });

  it('should skip cacheReadCostUsd when no cacheReadPrice set', () => {
    const result = calculateCost(gpt4Entry, 1_000_000, 500_000, 200_000);
    expect(result.cacheReadCostUsd).toBeUndefined();
    expect(result.cacheCreationCostUsd).toBeUndefined();
  });

  it('should skip cacheCreationCostUsd when no cacheCreationPrice set', () => {
    const entry: PriceEntry = {
      inputTokenPrice: 15.0,
      outputTokenPrice: 75.0,
      cacheReadPrice: 1.5,
      effectiveDate: '2024-03-04',
    };
    const result = calculateCost(entry, 1_000_000, 500_000, 0, 100_000);
    expect(result.cacheReadCostUsd).toBeUndefined();
    expect(result.cacheCreationCostUsd).toBeUndefined();
  });

  it('should handle model with zero prices (free tier)', () => {
    const freeEntry: PriceEntry = {
      inputTokenPrice: 0,
      outputTokenPrice: 0,
      effectiveDate: '2024-01-01',
    };
    const result = calculateCost(freeEntry, 1_000_000, 500_000);
    expect(result.inputCostUsd).toBe(0);
    expect(result.outputCostUsd).toBe(0);
  });
});
