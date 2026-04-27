import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

import type { MetricsExporter } from '@/exporter/types.js';

export function createOtlpExporter(options?: { endpoint?: string }): MetricsExporter {
  const metricExporter = new OTLPMetricExporter({
    url: options?.endpoint ?? 'http://localhost:4318/v1/metrics',
  });

  const reader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
  });

  return {
    async export(): Promise<void> {
      await reader.forceFlush();
    },

    async shutdown(): Promise<void> {
      await reader.shutdown();
    },
  };
}
