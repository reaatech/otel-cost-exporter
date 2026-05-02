import type { PriceEntry } from '@reaatech/otel-cost-exporter-core';

export interface PricingProvider {
  getPrice(model: string, provider: string): PriceEntry | null;
  supports(model: string, provider: string): boolean;
  update(): Promise<void>;
  load(): Promise<void>;
}
