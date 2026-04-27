import { type Meter } from '@opentelemetry/api';

import type { CostResult } from '@/calculator/engine.js';

import { METRIC_INPUT_COST, METRIC_OUTPUT_COST, METRIC_TOTAL_COST } from './definitions.js';

export interface MetricsBuilder {
  recordCost(result: CostResult, labels?: Record<string, string>): void;
}

export function createMetricsBuilder(
  meter: Meter,
  prefix?: string,
  extraLabels?: Record<string, string>,
): MetricsBuilder {
  const inputCounter = meter.createCounter(
    prefix ? `${prefix}.${METRIC_INPUT_COST}` : METRIC_INPUT_COST,
    {
      description: 'Cost of input tokens in USD',
    },
  );

  const outputCounter = meter.createCounter(
    prefix ? `${prefix}.${METRIC_OUTPUT_COST}` : METRIC_OUTPUT_COST,
    {
      description: 'Cost of output tokens in USD',
    },
  );

  const totalCounter = meter.createCounter(
    prefix ? `${prefix}.${METRIC_TOTAL_COST}` : METRIC_TOTAL_COST,
    {
      description: 'Total LLM cost in USD',
    },
  );

  return {
    recordCost(result: CostResult, labels?: Record<string, string>): void {
      const attributes: Record<string, string> = {
        model: result.model,
        provider: result.provider,
        ...extraLabels,
        ...labels,
      };

      inputCounter.add(result.inputCostUsd, attributes);
      outputCounter.add(result.outputCostUsd, attributes);
      totalCounter.add(result.totalCostUsd, attributes);
    },
  };
}
