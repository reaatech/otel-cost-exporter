import type { PriceEntry } from '@/types/domain.js';

export interface PricingProvider {
  getPrice(model: string, provider: string): PriceEntry | null;
  supports(model: string, provider: string): boolean;
  update(): Promise<void>;
  load(): Promise<void>;
}
