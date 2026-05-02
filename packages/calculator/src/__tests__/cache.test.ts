import { beforeEach, describe, expect, it } from 'vitest';

import { createPricingCache } from '@reaatech/otel-cost-exporter-calculator';
import type { PricingCache } from '@reaatech/otel-cost-exporter-calculator';
import type { PriceEntry } from '@reaatech/otel-cost-exporter-core';

function makeEntry(overrides?: Partial<PriceEntry>): PriceEntry {
  return {
    inputTokenPrice: 30.0,
    outputTokenPrice: 60.0,
    effectiveDate: '2024-01-01',
    ...overrides,
  };
}

describe('createPricingCache', () => {
  describe('basic operations', () => {
    let cache: PricingCache;

    beforeEach(() => {
      cache = createPricingCache();
    });

    it('should store and retrieve entries by model and provider', () => {
      const entry = makeEntry();
      cache.set('gpt-4', 'openai', entry);

      const result = cache.get('gpt-4', 'openai');
      expect(result).toEqual(entry);
    });

    it('should return undefined for missing entries', () => {
      const result = cache.get('gpt-4', 'openai');
      expect(result).toBeUndefined();
    });

    it('should return true from has for stored entries', () => {
      cache.set('gpt-4', 'openai', makeEntry());
      expect(cache.has('gpt-4', 'openai')).toBe(true);
    });

    it('should return false from has for missing entries', () => {
      expect(cache.has('gpt-4', 'openai')).toBe(false);
    });

    it('should report correct size', () => {
      expect(cache.size).toBe(0);
      cache.set('gpt-4', 'openai', makeEntry());
      expect(cache.size).toBe(1);
      cache.set('claude-3', 'anthropic', makeEntry());
      expect(cache.size).toBe(2);
    });

    it('should overwrite existing entries for the same composite key', () => {
      const original = makeEntry({ inputTokenPrice: 30.0 });
      const updated = makeEntry({ inputTokenPrice: 15.0 });

      cache.set('gpt-4', 'openai', original);
      cache.set('gpt-4', 'openai', updated);

      const result = cache.get('gpt-4', 'openai');
      expect(result?.inputTokenPrice).toBe(15.0);
      expect(cache.size).toBe(1);
    });

    it('should treat different providers with the same model as separate entries', () => {
      const openaiEntry = makeEntry({ inputTokenPrice: 30.0 });
      const azureEntry = makeEntry({ inputTokenPrice: 25.0 });

      cache.set('gpt-4', 'openai', openaiEntry);
      cache.set('gpt-4', 'azure', azureEntry);

      expect(cache.size).toBe(2);
      expect(cache.get('gpt-4', 'openai')?.inputTokenPrice).toBe(30.0);
      expect(cache.get('gpt-4', 'azure')?.inputTokenPrice).toBe(25.0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict the least recently used entry when at capacity', () => {
      const cache = createPricingCache(3);

      cache.set('a', 'p1', makeEntry());
      cache.set('b', 'p1', makeEntry());
      cache.set('c', 'p1', makeEntry());

      // Access 'a' so it becomes most recently used
      cache.get('a', 'p1');

      // Now 'b' is LRU. Add a new entry to trigger eviction.
      cache.set('d', 'p1', makeEntry());

      expect(cache.has('b', 'p1')).toBe(false);
      expect(cache.has('a', 'p1')).toBe(true);
      expect(cache.has('c', 'p1')).toBe(true);
      expect(cache.has('d', 'p1')).toBe(true);
      expect(cache.size).toBe(3);
    });

    it('should evict the oldest entry when nothing has been accessed', () => {
      const cache = createPricingCache(2);

      cache.set('first', 'p1', makeEntry());
      cache.set('second', 'p1', makeEntry());
      cache.set('third', 'p1', makeEntry());

      expect(cache.has('first', 'p1')).toBe(false);
      expect(cache.has('second', 'p1')).toBe(true);
      expect(cache.has('third', 'p1')).toBe(true);
    });

    it('should not evict when at capacity and setting an existing key', () => {
      const cache = createPricingCache(2);

      cache.set('a', 'p1', makeEntry());
      cache.set('b', 'p1', makeEntry());
      cache.set('a', 'p1', makeEntry({ inputTokenPrice: 99 }));

      expect(cache.size).toBe(2);
      expect(cache.has('b', 'p1')).toBe(true);
    });

    it('should promote a recently set entry in eviction order', () => {
      const cache = createPricingCache(2);

      cache.set('a', 'p1', makeEntry());
      cache.set('b', 'p1', makeEntry());
      // Re-set 'a' — this promotes it to MRU, making 'b' LRU
      cache.set('a', 'p1', makeEntry());
      cache.set('c', 'p1', makeEntry());

      expect(cache.has('b', 'p1')).toBe(false);
      expect(cache.has('a', 'p1')).toBe(true);
      expect(cache.has('c', 'p1')).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should track hit and miss counts', () => {
      const cache = createPricingCache();

      cache.get('gpt-4', 'openai'); // miss
      cache.get('gpt-4', 'openai'); // miss
      cache.set('gpt-4', 'openai', makeEntry());
      cache.get('gpt-4', 'openai'); // hit
      cache.get('gpt-4', 'openai'); // hit
      cache.get('claude-3', 'anthropic'); // miss

      const stats = cache.stats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(3);
      expect(stats.size).toBe(1);
      expect(stats.maxSize).toBe(1000);
    });

    it('should report hitRate as hits / (hits + misses)', () => {
      const cache = createPricingCache();
      cache.set('gpt-4', 'openai', makeEntry());
      cache.get('gpt-4', 'openai'); // hit
      cache.get('claude-3', 'anthropic'); // miss

      const stats = cache.stats();
      expect(stats.hitRate).toBeCloseTo(0.5, 4);
    });

    it('should report hitRate 0 when there are no lookups', () => {
      const cache = createPricingCache();
      const stats = cache.stats();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all entries and reset statistics', () => {
      const cache = createPricingCache();
      cache.set('gpt-4', 'openai', makeEntry());
      cache.set('claude-3', 'anthropic', makeEntry());
      cache.get('gpt-4', 'openai'); // hit
      cache.get('unknown', 'p1'); // miss

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.has('gpt-4', 'openai')).toBe(false);

      const stats = cache.stats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });
});
