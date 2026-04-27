import type { PriceEntry } from '@/types/domain.js';
import type { PricingProvider } from '@/pricing/types.js';
import type { PricingTableData } from '@/pricing/loader.js';

export interface PricingTable extends PricingProvider {
  readonly version: string;
  readonly lastUpdated: string;
  readonly providers: ReadonlyMap<string, ReadonlyMap<string, PriceEntry>>;
  getPrice(model: string, provider: string): PriceEntry | null;
  supports(provider: string): boolean;
  supports(model: string, provider: string): boolean;
  getAllModels(provider: string): ReadonlyMap<string, PriceEntry> | undefined;
  readonly modelCount: number;
}

function compilePattern(pattern: string): RegExp {
  const escaped = pattern.replace(/[.^$+{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}

export function createPricingTable(initialData: PricingTableData): PricingTable {
  let data = initialData;
  const patternCache = new Map<string, RegExp>();

  function rebuildReadonlyProviders(): { map: Map<string, ReadonlyMap<string, PriceEntry>>; count: number } {
    const map = new Map<string, ReadonlyMap<string, PriceEntry>>();
    let count = 0;
    for (const [provider, models] of data.providers) {
      map.set(provider, models);
      count += models.size;
    }
    return { map, count };
  }

  let { map: readonlyProviders, count: compiledModelCount } = rebuildReadonlyProviders();

  function getPatternEntries(provider: string): Array<readonly [RegExp, PriceEntry]> {
    const models = data.providers.get(provider);
    if (!models) return [];

    const result: Array<readonly [RegExp, PriceEntry]> = [];
    for (const [key, entry] of models) {
      if (key.includes('*')) {
        let regex = patternCache.get(key);
        if (!regex) {
          regex = compilePattern(key);
          patternCache.set(key, regex);
        }
        result.push([regex, entry] as const);
      }
    }
    return result;
  }

  const table: PricingTable = {
    get version(): string {
      return data.version;
    },
    get lastUpdated(): string {
      return data.lastUpdated;
    },
    get providers(): ReadonlyMap<string, ReadonlyMap<string, PriceEntry>> {
      return readonlyProviders;
    },
    get modelCount(): number {
      return compiledModelCount;
    },

    getPrice(model: string, provider: string): PriceEntry | null {
      const models = data.providers.get(provider);
      if (!models) return null;

      const exact = models.get(model);
      if (exact) return exact;

      for (const [regex, entry] of getPatternEntries(provider)) {
        if (regex.test(model)) return entry;
      }

      return null;
    },

    supports(arg1: string, arg2?: string): boolean {
      if (arg2 === undefined) {
        return data.providers.has(arg1);
      }
      return this.getPrice(arg1, arg2) !== null;
    },

    getAllModels(provider: string): ReadonlyMap<string, PriceEntry> | undefined {
      return readonlyProviders.get(provider);
    },

    async update(): Promise<void> {
      const { loadPricingData } = await import('@/pricing/loader.js');
      const fresh = await loadPricingData();

      data = {
        version: fresh.version,
        lastUpdated: fresh.lastUpdated,
        providers: fresh.providers,
      };

      const rebuilt = rebuildReadonlyProviders();
      readonlyProviders = rebuilt.map;
      compiledModelCount = rebuilt.count;
    },

    async load(): Promise<void> {
      return this.update();
    },
  };

  return table;
}
