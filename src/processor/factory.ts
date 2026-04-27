import type { Config } from '@/config/config.js';
import type { SpanProcessor, SpanProcessorDeps } from './processor.js';
import type { CostCalculator } from '@/calculator/engine.js';

import { createCostCalculator } from '@/calculator/engine.js';
import { createPricingCache } from '@/calculator/cache.js';
import { createModelNormalizer } from '@/calculator/normalizer.js';
import { loadPricingData } from '@/pricing/loader.js';
import { createPricingTable } from '@/pricing/table.js';

export interface ProcessorFactory {
  createProcessor(): Promise<SpanProcessor>;
}

export function createProcessorFactory(config: Config): ProcessorFactory {
  return {
    async createProcessor(): Promise<SpanProcessor> {
      const pricingData = await loadPricingData({
        customTables: config.pricing.customTablePath
          ? { custom: config.pricing.customTablePath }
          : undefined,
      });

      const pricingTable = createPricingTable(pricingData);
      const cache = createPricingCache();
      const normalizer = createModelNormalizer();

      const calculator: CostCalculator = createCostCalculator({
        pricing: pricingTable,
        cache,
        normalizer,
        defaultPrice: config.pricing.defaultPrice,
      });

      const deps: SpanProcessorDeps = { calculator };
      const { createSpanProcessor } = await import('./processor.js');
      return createSpanProcessor(deps);
    },
  };
}
