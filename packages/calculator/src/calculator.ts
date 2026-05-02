import type { CostBreakdown, PriceEntry } from '@reaatech/otel-cost-exporter-core';

import { TOKENS_PER_UNIT, roundTo } from '@reaatech/otel-cost-exporter-core';

export interface CalculatorDeps {
  readonly pricing: {
    getPrice(model: string, provider: string): PriceEntry | null;
  };
}

export function calculateCost(
  entry: PriceEntry,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheCreationTokens = 0,
): CostBreakdown {
  const billableInputTokens = Math.max(0, inputTokens - cacheReadTokens);

  const inputCost = (billableInputTokens / TOKENS_PER_UNIT) * entry.inputTokenPrice;
  const outputCost = (outputTokens / TOKENS_PER_UNIT) * entry.outputTokenPrice;

  const breakdown: CostBreakdown = {
    inputCostUsd: roundTo(inputCost, 6),
    outputCostUsd: roundTo(outputCost, 6),
  };

  if (entry.cacheReadPrice && cacheReadTokens > 0) {
    breakdown.cacheReadCostUsd = roundTo(
      (cacheReadTokens / TOKENS_PER_UNIT) * entry.cacheReadPrice,
      6,
    );
  }

  if (entry.cacheCreationPrice && cacheCreationTokens > 0) {
    breakdown.cacheCreationCostUsd = roundTo(
      (cacheCreationTokens / TOKENS_PER_UNIT) * entry.cacheCreationPrice,
      6,
    );
  }

  return breakdown;
}
