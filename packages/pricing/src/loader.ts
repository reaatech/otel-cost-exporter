import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

import type { PriceEntry } from '@reaatech/otel-cost-exporter-core';

const PriceEntryYamlSchema = z.object({
  input_token_price: z.number().positive('Input token price must be positive'),
  output_token_price: z.number().positive('Output token price must be positive'),
  cache_read_price: z.number().positive().optional(),
  cache_creation_price: z.number().positive().optional(),
  effective_date: z
    .string()
    .min(1, 'Effective date is required')
    .datetime({ message: 'Effective date must be an ISO 8601 datetime string' }),
});

function convertEntry(raw: z.infer<typeof PriceEntryYamlSchema>): PriceEntry {
  const entry: PriceEntry = {
    inputTokenPrice: raw.input_token_price,
    outputTokenPrice: raw.output_token_price,
    effectiveDate: raw.effective_date,
  };
  if (raw.cache_read_price !== undefined) {
    entry.cacheReadPrice = raw.cache_read_price;
  }
  if (raw.cache_creation_price !== undefined) {
    entry.cacheCreationPrice = raw.cache_creation_price;
  }
  return entry;
}

interface RawProviderYaml {
  display_name?: string;
  website?: string;
  models: Record<string, unknown>;
}

interface RawPricingYaml {
  version?: string;
  last_updated?: string;
  providers: Record<string, RawProviderYaml>;
}

export interface PricingTableData {
  version: string;
  lastUpdated: string;
  providers: Map<string, Map<string, PriceEntry>>;
}

export interface LoaderOptions {
  customTables?: Record<string, string>;
  tablesDir?: string;
  logger?: { warn(msg: string, ...args: unknown[]): void };
}

const BUNDLED_TABLE_NAMES = [
  'openai.yaml',
  'anthropic.yaml',
  'google.yaml',
  'aws-bedrock.yaml',
  'azure.yaml',
] as const;

declare const __MODULE_DIRNAME__: string;

function defaultTablesDir(): string {
  return path.resolve(__MODULE_DIRNAME__, '../pricing-tables');
}

async function parseSingleTable(filePath: string): Promise<PricingTableData> {
  const content = await readFile(filePath, 'utf-8');
  const parsed: unknown = parseYaml(content);
  const raw = parsed as RawPricingYaml;

  const providers = new Map<string, Map<string, PriceEntry>>();

  for (const [providerName, providerData] of Object.entries(raw.providers)) {
    const models = new Map<string, PriceEntry>();
    for (const [modelName, modelData] of Object.entries(providerData.models)) {
      const validated = PriceEntryYamlSchema.parse(modelData);
      models.set(modelName, convertEntry(validated));
    }
    providers.set(providerName, models);
  }

  return {
    version: raw.version ?? '',
    lastUpdated: raw.last_updated ?? '',
    providers,
  };
}

function mergeModelMaps(
  base: Map<string, PriceEntry>,
  overrides: Map<string, PriceEntry>,
): Map<string, PriceEntry> {
  const merged = new Map(base);
  for (const [key, val] of overrides) {
    merged.set(key, val);
  }
  return merged;
}

function compareVersions(a: string, b: string): number {
  const parse = (v: string): number[] => {
    const parts = v.split(/[.\-_]/);
    return parts.map((p) => {
      const n = Number.parseInt(p, 10);
      return Number.isNaN(n) ? 0 : n;
    });
  };
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export async function loadPricingData(options: LoaderOptions = {}): Promise<PricingTableData> {
  const tablesDir = options.tablesDir ?? defaultTablesDir();
  const { customTables, logger } = options;
  const log = logger ?? {
    warn(): void {
      // no-op: logging not configured
    },
  };

  const results = await Promise.allSettled(
    BUNDLED_TABLE_NAMES.map((file) => parseSingleTable(path.join(tablesDir, file))),
  );

  const tables = results
    .filter((r): r is PromiseFulfilledResult<PricingTableData> => r.status === 'fulfilled')
    .map((r) => r.value);

  if (tables.length === 0) {
    throw new Error('No bundled pricing tables could be loaded');
  }

  for (let i = 0; i < results.length; i++) {
    if (results[i]?.status === 'rejected') {
      const fileName = BUNDLED_TABLE_NAMES[i];
      if (fileName) {
        log.warn(
          `Failed to load pricing table ${fileName}:`,
          (results[i] as PromiseRejectedResult).reason,
        );
      }
    }
  }

  const providers = new Map<string, Map<string, PriceEntry>>();
  let version = '';
  let lastUpdated = '';

  for (const table of tables) {
    for (const [providerName, models] of table.providers) {
      const existing = providers.get(providerName);
      if (existing) {
        for (const [modelName, entry] of models) {
          existing.set(modelName, entry);
        }
      } else {
        providers.set(providerName, new Map(models));
      }
    }
    if (compareVersions(table.version, version) > 0) version = table.version;
    if (table.lastUpdated > lastUpdated) lastUpdated = table.lastUpdated;
  }

  if (customTables) {
    for (const [, customPath] of Object.entries(customTables)) {
      const customTable = await parseSingleTable(customPath);
      for (const [providerName, customModels] of customTable.providers) {
        const existing = providers.get(providerName);
        if (existing) {
          providers.set(providerName, mergeModelMaps(existing, customModels));
        } else {
          providers.set(providerName, customModels);
        }
      }
    }
  }

  return { version, lastUpdated, providers };
}
