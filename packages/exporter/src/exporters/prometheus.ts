import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

import type { MetricsExporter } from './types.js';

export function createPrometheusExporter(options?: {
  port?: number;
  endpoint?: string;
}): MetricsExporter {
  const exporter = new PrometheusExporter({
    port: options?.port ?? 9464,
    endpoint: options?.endpoint ?? '/metrics',
  });

  return {
    async export(): Promise<void> {},

    async shutdown(): Promise<void> {
      await exporter.shutdown();
    },
  };
}
