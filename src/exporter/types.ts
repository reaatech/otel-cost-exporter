import type { CostBreakdown } from '@/types/domain.js';

export interface MetricsExporter {
  export(metrics?: CostBreakdown[]): Promise<void>;
  shutdown(): Promise<void>;
}
