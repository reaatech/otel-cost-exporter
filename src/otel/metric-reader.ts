import type { MeterProvider } from '@opentelemetry/sdk-metrics';

import type { MetricsBuilder } from '@/metrics/builder.js';
import { createMetricsBuilder } from '@/metrics/builder.js';

export interface CostMetricReaderResult {
  metricsBuilder: MetricsBuilder;
  shutdown(): Promise<void>;
}

export function createCostMetricReader(options: {
  meterProvider: MeterProvider;
  prefix?: string;
  extraLabels?: Record<string, string>;
}): CostMetricReaderResult {
  const meter = options.meterProvider.getMeter('otel-cost-exporter');
  const metricsBuilder = createMetricsBuilder(meter, options.prefix, options.extraLabels);

  return {
    metricsBuilder,
    async shutdown(): Promise<void> {
      await options.meterProvider.shutdown();
    },
  };
}
