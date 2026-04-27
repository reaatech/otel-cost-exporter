import type { PriceEntry } from '@/types/domain.js';

export interface PricingCache {
  get(model: string, provider: string): PriceEntry | undefined;
  set(model: string, provider: string, entry: PriceEntry): void;
  has(model: string, provider: string): boolean;
  readonly size: number;
  clear(): void;
  stats(): CacheStats;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  hitRate: number;
}

const DEFAULT_MAX_SIZE = 1000;

function makeKey(provider: string, model: string): string {
  return `${provider}:${model}`;
}

export function createPricingCache(maxSize = DEFAULT_MAX_SIZE): PricingCache {
  const cache = new Map<string, PriceEntry>();
  const accessOrder: string[] = [];
  let hits = 0;
  let misses = 0;

  function touch(key: string): void {
    const idx = accessOrder.indexOf(key);
    if (idx > -1) {
      accessOrder.splice(idx, 1);
    }
    accessOrder.push(key);
  }

  function evictIfNeeded(): void {
    while (cache.size >= maxSize) {
      const lru = accessOrder.shift();
      if (lru !== undefined) {
        cache.delete(lru);
      }
    }
  }

  return {
    get(model: string, provider: string): PriceEntry | undefined {
      const key = makeKey(provider, model);
      const entry = cache.get(key);
      if (entry !== undefined) {
        hits++;
        touch(key);
        return entry;
      }
      misses++;
      return undefined;
    },

    set(model: string, provider: string, entry: PriceEntry): void {
      const key = makeKey(provider, model);
      if (cache.has(key)) {
        cache.set(key, entry);
        touch(key);
      } else {
        evictIfNeeded();
        cache.set(key, entry);
        accessOrder.push(key);
      }
    },

    has(model: string, provider: string): boolean {
      return cache.has(makeKey(provider, model));
    },

    get size(): number {
      return cache.size;
    },

    clear(): void {
      cache.clear();
      accessOrder.length = 0;
      hits = 0;
      misses = 0;
    },

    stats(): CacheStats {
      const total = hits + misses;
      return {
        hits,
        misses,
        size: cache.size,
        maxSize,
        hitRate: total > 0 ? hits / total : 0,
      };
    },
  };
}
