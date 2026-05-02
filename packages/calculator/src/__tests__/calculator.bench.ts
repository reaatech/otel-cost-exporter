import { calculateCost } from '@reaatech/otel-cost-exporter-calculator';
import type { PriceEntry } from '@reaatech/otel-cost-exporter-core';
import { bench, describe } from 'vitest';

const gpt4Entry: PriceEntry = {
  inputTokenPrice: 30.0,
  outputTokenPrice: 60.0,
  effectiveDate: '2024-01-01',
};

describe('CostCalculator benchmarks', () => {
  bench('single cost calculation', () => {
    calculateCost(gpt4Entry, 1_000_000, 500_000);
  });

  bench('batch of 100 calculations', () => {
    for (let i = 0; i < 100; i++) {
      calculateCost(gpt4Entry, 1_000_000, 500_000);
    }
  });

  bench('cache-aware Anthropic calculation', () => {
    const claudeEntry: PriceEntry = {
      inputTokenPrice: 15.0,
      outputTokenPrice: 75.0,
      cacheReadPrice: 1.5,
      cacheCreationPrice: 18.75,
      effectiveDate: '2024-03-04',
    };
    calculateCost(claudeEntry, 1_000_000, 500_000, 200_000, 100_000);
  });
});
