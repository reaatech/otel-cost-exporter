import type { PriceEntry, CostBreakdown } from '@/types/domain.js';
import type { PricingCache } from './cache.js';
import type { ModelNormalizer, NormalizedModel } from './normalizer.js';

import { calculateCost as computeCost } from './calculator.js';
import { roundTo } from './constants.js';

export interface CostCalculatorDeps {
  readonly pricing: {
    getPrice(model: string, provider: string): PriceEntry | null;
  };
  readonly cache: PricingCache;
  readonly normalizer: ModelNormalizer;
  readonly defaultPrice?: number;
}

export interface CostResult {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  cacheReadCostUsd: number;
  cacheCreationCostUsd: number;
  totalCostUsd: number;
}

export interface CostCalculator {
  calculate(
    model: string,
    inputTokens: number,
    outputTokens: number,
    options?: {
      provider?: string;
      cacheReadTokens?: number;
      cacheCreationTokens?: number;
    },
  ): CostResult;
}

export class PricingError extends Error {
  constructor(
    message: string,
    public readonly code: 'MODEL_NOT_FOUND' | 'INVALID_PRICE' | 'TABLE_NOT_LOADED',
  ) {
    super(message);
    this.name = 'PricingError';
  }
}

function createDefaultEntry(defaultPrice: number): PriceEntry {
  return {
    inputTokenPrice: defaultPrice,
    outputTokenPrice: defaultPrice,
    effectiveDate: new Date().toISOString(),
  };
}

function entryToResult(
  entry: PriceEntry,
  normalized: NormalizedModel,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens: number,
  cacheCreationTokens: number,
): CostResult {
  const breakdown: CostBreakdown = computeCost(
    entry,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
  );

  const inputCostUsd = breakdown.inputCostUsd;
  const outputCostUsd = breakdown.outputCostUsd;

  return {
    model: normalized.canonicalName,
    provider: normalized.provider,
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens,
    inputCostUsd,
    outputCostUsd,
    cacheReadCostUsd: breakdown.cacheReadCostUsd ?? 0,
    cacheCreationCostUsd: breakdown.cacheCreationCostUsd ?? 0,
    totalCostUsd: roundTo(
      inputCostUsd +
        outputCostUsd +
        (breakdown.cacheReadCostUsd ?? 0) +
        (breakdown.cacheCreationCostUsd ?? 0),
      6,
    ),
  };
}

export function createCostCalculator(deps: CostCalculatorDeps): CostCalculator {
  return {
    calculate(
      model: string,
      inputTokens: number,
      outputTokens: number,
      options?: {
        provider?: string;
        cacheReadTokens?: number;
        cacheCreationTokens?: number;
      },
    ): CostResult {
      if (inputTokens < 0 || outputTokens < 0) {
        throw new PricingError('Token counts must be non-negative', 'INVALID_PRICE');
      }

      const crt = options?.cacheReadTokens ?? 0;
      const cct = options?.cacheCreationTokens ?? 0;

      const normalized = deps.normalizer.normalize(model, options?.provider);
      if (!normalized) {
        if (deps.defaultPrice !== undefined) {
          const defaultEntry = createDefaultEntry(deps.defaultPrice);
          return entryToResult(
            defaultEntry,
            { provider: 'unknown', canonicalName: model },
            inputTokens,
            outputTokens,
            crt,
            cct,
          );
        }
        throw new PricingError(`Unknown model: ${model}`, 'MODEL_NOT_FOUND');
      }

      let entry = deps.cache.get(normalized.canonicalName, normalized.provider);

      if (!entry) {
        const priceEntry = deps.pricing.getPrice(normalized.canonicalName, normalized.provider);

        if (!priceEntry) {
          if (deps.defaultPrice !== undefined) {
            entry = createDefaultEntry(deps.defaultPrice);
            deps.cache.set(normalized.canonicalName, normalized.provider, entry);
            return entryToResult(entry, normalized, inputTokens, outputTokens, crt, cct);
          }
          throw new PricingError(
            `Model not found in pricing table: ${normalized.canonicalName} (${normalized.provider})`,
            'MODEL_NOT_FOUND',
          );
        }

        entry = priceEntry;
        deps.cache.set(normalized.canonicalName, normalized.provider, entry);
      }

      return entryToResult(entry, normalized, inputTokens, outputTokens, crt, cct);
    },
  };
}
