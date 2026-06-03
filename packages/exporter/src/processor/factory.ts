import type { CostCalculator } from '@reaatech/otel-cost-exporter-calculator';
import {
  createCostCalculator,
  createModelNormalizer,
  createPricingCache,
} from '@reaatech/otel-cost-exporter-calculator';
import { createPricingTable, loadPricingData } from '@reaatech/otel-cost-exporter-pricing';
import type { Config } from '../config/config.js';
import type { SpanProcessor, SpanProcessorDeps } from './processor.js';

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
