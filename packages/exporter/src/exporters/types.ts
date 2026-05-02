import type { CostBreakdown } from '@reaatech/otel-cost-exporter-core';

export interface MetricsExporter {
  export(metrics?: CostBreakdown[]): Promise<void>;
  shutdown(): Promise<void>;
}
