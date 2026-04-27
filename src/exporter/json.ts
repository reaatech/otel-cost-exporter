import type { CostBreakdown } from '@/types/domain.js';

import type { MetricsExporter } from '@/exporter/types.js';

export function createJsonExporter(): MetricsExporter {
  return {
    async export(metrics?: CostBreakdown[]): Promise<void> {
      if (!metrics) return;
      for (const metric of metrics) {
        process.stdout.write(`${JSON.stringify(metric)}\n`);
      }
    },

    async shutdown(): Promise<void> {
      // No-op: stdout does not need cleanup
    },
  };
}
