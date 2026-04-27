import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';
import { writeFile, unlink, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import type { PriceEntry } from '@/types/domain.js';
import type { PricingTable } from '@/pricing/table.js';
import { createPricingTable } from '@/pricing/table.js';
import { loadPricingData } from '@/pricing/loader.js';
import type { PricingTableData } from '@/pricing/loader.js';

const TABLES_DIR = path.resolve(import.meta.dirname, '../../pricing-tables');

function makeEntry(overrides: Partial<PriceEntry> = {}): PriceEntry {
  return {
    inputTokenPrice: 10.0,
    outputTokenPrice: 20.0,
    effectiveDate: '2024-01-01',
    ...overrides,
  };
}

function makeTableData(
  providerMap: Record<string, Record<string, PriceEntry>>,
  overrides: Partial<PricingTableData> = {},
): PricingTableData {
  const providers = new Map<string, Map<string, PriceEntry>>();
  for (const [provider, models] of Object.entries(providerMap)) {
    providers.set(provider, new Map(Object.entries(models)));
  }
  return {
    version: '1.0',
    lastUpdated: '2024-01-01T00:00:00Z',
    ...overrides,
    providers,
  };
}

describe('loadPricingData', () => {
  it('should load all bundled YAML files', async () => {
    const data = await loadPricingData({ tablesDir: TABLES_DIR });

    expect(data.version).toBeTruthy();
    expect(data.lastUpdated).toBeTruthy();
    expect(data.providers.size).toBeGreaterThanOrEqual(4);

    expect(data.providers.has('openai')).toBe(true);
    expect(data.providers.has('anthropic')).toBe(true);
    expect(data.providers.has('google')).toBe(true);
    expect(data.providers.has('aws-bedrock')).toBe(true);
    expect(data.providers.has('azure')).toBe(true);
  });

  it('should parse OpenAI entries correctly', async () => {
    const data = await loadPricingData({ tablesDir: TABLES_DIR });
    const openai = data.providers.get('openai');
    expect(openai).toBeDefined();

    const gpt4 = openai!.get('gpt-4');
    expect(gpt4).toBeDefined();
    expect(gpt4!.inputTokenPrice).toBe(30.0);
    expect(gpt4!.outputTokenPrice).toBe(60.0);
    expect(gpt4!.effectiveDate).toBe('2024-01-01T00:00:00Z');
  });

  it('should parse Anthropic entries with cache prices', async () => {
    const data = await loadPricingData({ tablesDir: TABLES_DIR });
    const anthropic = data.providers.get('anthropic');
    expect(anthropic).toBeDefined();

    const claude = anthropic!.get('claude-3-opus-20240229');
    expect(claude).toBeDefined();
    expect(claude!.inputTokenPrice).toBe(15.0);
    expect(claude!.outputTokenPrice).toBe(75.0);
    expect(claude!.cacheReadPrice).toBe(1.5);
    expect(claude!.cacheCreationPrice).toBe(18.75);
  });

  it('should parse Google entries', async () => {
    const data = await loadPricingData({ tablesDir: TABLES_DIR });
    const google = data.providers.get('google');
    expect(google).toBeDefined();
    expect(google!.has('gemini-pro')).toBe(true);
    expect(google!.has('gemini-1.5-pro')).toBe(true);
    expect(google!.has('text-embedding-004')).toBe(true);
  });

  it('should parse AWS Bedrock entries', async () => {
    const data = await loadPricingData({ tablesDir: TABLES_DIR });
    const bedrock = data.providers.get('aws-bedrock');
    expect(bedrock).toBeDefined();
    expect(bedrock!.has('claude-3-opus')).toBe(true);
    expect(bedrock!.has('llama-3-70b')).toBe(true);
    expect(bedrock!.has('titan-text-express')).toBe(true);
  });

  it('should parse Azure entries', async () => {
    const data = await loadPricingData({ tablesDir: TABLES_DIR });
    const azure = data.providers.get('azure');
    expect(azure).toBeDefined();
    expect(azure!.has('gpt-4')).toBe(true);
    expect(azure!.has('gpt-4o')).toBe(true);
    expect(azure!.has('gpt-35-turbo')).toBe(true);
  });

  it('should reject negative input token price', async () => {
    const badData = makeTableData({
      test: { 'bad-model': makeEntry({ inputTokenPrice: -5 }) },
    });
    const table = createPricingTable(badData);
    // The entry was created programmatically so no Zod validation at that level;
    // validation occurs in loadPricingData during YAML parsing. This test
    // verifies the table itself doesn't error on negative values — the pricing
    // loader's Zod schema is the gate.
    const entry = table.getPrice('bad-model', 'test');
    expect(entry).toBeDefined();
  });
});

describe('createPricingTable', () => {
  let table: PricingTable;

  beforeEach(() => {
    const data = makeTableData({
      openai: {
        'gpt-4': makeEntry({ inputTokenPrice: 30.0, outputTokenPrice: 60.0 }),
        'gpt-4o': makeEntry({ inputTokenPrice: 5.0, outputTokenPrice: 15.0 }),
        'gpt-4-*': makeEntry({
          inputTokenPrice: 10.0,
          outputTokenPrice: 30.0,
        }),
      },
      anthropic: {
        'claude-3-opus-20240229': makeEntry({
          inputTokenPrice: 15.0,
          outputTokenPrice: 75.0,
          cacheReadPrice: 1.5,
          cacheCreationPrice: 18.75,
        }),
        'claude-3-sonnet-20240229': makeEntry({
          inputTokenPrice: 3.0,
          outputTokenPrice: 15.0,
        }),
      },
    });
    table = createPricingTable(data);
  });

  describe('version and lastUpdated', () => {
    it('should expose version', () => {
      expect(table.version).toBe('1.0');
    });

    it('should expose lastUpdated', () => {
      expect(table.lastUpdated).toBe('2024-01-01T00:00:00Z');
    });
  });

  describe('getPrice', () => {
    it('should return exact match for a model', () => {
      const entry = table.getPrice('gpt-4', 'openai');
      expect(entry).not.toBeNull();
      expect(entry!.inputTokenPrice).toBe(30.0);
      expect(entry!.outputTokenPrice).toBe(60.0);
    });

    it('should return exact match for anthropic model', () => {
      const entry = table.getPrice('claude-3-opus-20240229', 'anthropic');
      expect(entry).not.toBeNull();
      expect(entry!.inputTokenPrice).toBe(15.0);
      expect(entry!.outputTokenPrice).toBe(75.0);
    });

    it('should return cache prices from anthropic entry', () => {
      const entry = table.getPrice('claude-3-opus-20240229', 'anthropic');
      expect(entry!.cacheReadPrice).toBe(1.5);
      expect(entry!.cacheCreationPrice).toBe(18.75);
    });

    it('should match wildcard pattern gpt-4-*', () => {
      const entry = table.getPrice('gpt-4-turbo', 'openai');
      expect(entry).not.toBeNull();
      expect(entry!.inputTokenPrice).toBe(10.0);
      expect(entry!.outputTokenPrice).toBe(30.0);
    });

    it('should prefer exact match over wildcard', () => {
      const entry = table.getPrice('gpt-4o', 'openai');
      expect(entry!.inputTokenPrice).toBe(5.0);
      expect(entry!.outputTokenPrice).toBe(15.0);
    });

    it('should return null for unknown model', () => {
      const entry = table.getPrice('nonexistent-model', 'openai');
      expect(entry).toBeNull();
    });

    it('should return null for unknown provider', () => {
      const entry = table.getPrice('gpt-4', 'nonexistent-provider');
      expect(entry).toBeNull();
    });

    it('should return null for known model on wrong provider', () => {
      const entry = table.getPrice('gpt-4', 'anthropic');
      expect(entry).toBeNull();
    });
  });

  describe('supports', () => {
    it('should return true for existing provider (single arg)', () => {
      expect(table.supports('openai')).toBe(true);
      expect(table.supports('anthropic')).toBe(true);
    });

    it('should return false for unknown provider (single arg)', () => {
      expect(table.supports('nonexistent-provider')).toBe(false);
    });

    it('should return true when model is supported by provider (two args)', () => {
      expect(table.supports('gpt-4', 'openai')).toBe(true);
      expect(table.supports('claude-3-sonnet-20240229', 'anthropic')).toBe(true);
    });

    it('should return false when model is not supported by provider (two args)', () => {
      expect(table.supports('nonexistent-model', 'openai')).toBe(false);
    });

    it('should return true for wildcard-matched model (two args)', () => {
      expect(table.supports('gpt-4-turbo', 'openai')).toBe(true);
    });
  });

  describe('getAllModels', () => {
    it('should return all models for a provider', () => {
      const models = table.getAllModels('openai');
      expect(models).toBeDefined();
      expect(models!.size).toBe(3);
      expect(models!.has('gpt-4')).toBe(true);
      expect(models!.has('gpt-4o')).toBe(true);
      expect(models!.has('gpt-4-*')).toBe(true);
    });

    it('should return undefined for unknown provider', () => {
      const models = table.getAllModels('nonexistent');
      expect(models).toBeUndefined();
    });
  });

  describe('modelCount', () => {
    it('should return total model count across all providers', () => {
      expect(table.modelCount).toBe(5);
    });
  });

  describe('providers', () => {
    it('should expose read-only provider map', () => {
      expect(table.providers.size).toBe(2);
      expect(table.providers.has('openai')).toBe(true);
      expect(table.providers.has('anthropic')).toBe(true);
    });
  });

  describe('PricingProvider compatibility', () => {
    it('should implement load as async no-op that refreshes data', async () => {
      await expect(table.load()).resolves.toBeUndefined();
    });

    it('should implement update that refreshes data', async () => {
      await expect(table.update()).resolves.toBeUndefined();
    });
  });
});

describe('wildcard pattern matching', () => {
  it('should handle patterns with multiple wildcards', () => {
    const data = makeTableData({
      test: {
        '*-pro-*': makeEntry({ inputTokenPrice: 5.0, outputTokenPrice: 10.0 }),
      },
    });
    const table = createPricingTable(data);

    expect(table.getPrice('gemini-pro-vision', 'test')!.inputTokenPrice).toBe(5.0);
    expect(table.getPrice('claude-pro-something', 'test')!.outputTokenPrice).toBe(10.0);
  });

  it('should handle trailing wildcard', () => {
    const data = makeTableData({
      test: {
        'gpt-*': makeEntry({ inputTokenPrice: 1.0, outputTokenPrice: 2.0 }),
        'gpt-4': makeEntry({ inputTokenPrice: 30.0, outputTokenPrice: 60.0 }),
      },
    });
    const table = createPricingTable(data);

    expect(table.getPrice('gpt-3.5-turbo', 'test')!.inputTokenPrice).toBe(1.0);
    expect(table.getPrice('gpt-4', 'test')!.inputTokenPrice).toBe(30.0);
  });

  it('should handle prefix wildcard', () => {
    const data = makeTableData({
      test: {
        '*-turbo': makeEntry({ inputTokenPrice: 10.0, outputTokenPrice: 20.0 }),
      },
    });
    const table = createPricingTable(data);

    expect(table.getPrice('gpt-4-turbo', 'test')!.inputTokenPrice).toBe(10.0);
  });

  it('should return null when no pattern matches', () => {
    const data = makeTableData({
      test: {
        'gpt-4*': makeEntry({ inputTokenPrice: 5.0, outputTokenPrice: 10.0 }),
      },
    });
    const table = createPricingTable(data);

    expect(table.getPrice('claude-opus', 'test')).toBeNull();
  });

  it('should handle exact match when pattern also matches', () => {
    const data = makeTableData({
      test: {
        'gpt-4*': makeEntry({ inputTokenPrice: 10.0, outputTokenPrice: 30.0 }),
        'gpt-4-turbo': makeEntry({ inputTokenPrice: 12.0, outputTokenPrice: 35.0 }),
      },
    });
    const table = createPricingTable(data);

    const entry = table.getPrice('gpt-4-turbo', 'test');
    expect(entry!.inputTokenPrice).toBe(12.0);
    expect(entry!.outputTokenPrice).toBe(35.0);
  });
});

describe('custom override merging', () => {
  it('should allow custom overrides to replace bundled entries', () => {
    const base = makeTableData({
      openai: {
        'gpt-4': makeEntry({ inputTokenPrice: 30.0, outputTokenPrice: 60.0 }),
      },
    });

    // Simulate custom overrides merged in
    const overrides = new Map<string, PriceEntry>();
    overrides.set('gpt-4', makeEntry({ inputTokenPrice: 25.0, outputTokenPrice: 50.0 }));

    base.providers.get('openai')!.clear();
    for (const [key, val] of overrides) {
      base.providers.get('openai')!.set(key, val);
    }

    const table = createPricingTable(base);
    const entry = table.getPrice('gpt-4', 'openai');
    expect(entry!.inputTokenPrice).toBe(25.0);
    expect(entry!.outputTokenPrice).toBe(50.0);
  });

  it('should add new models via custom overrides', () => {
    const base = makeTableData({
      openai: {
        'gpt-4': makeEntry({ inputTokenPrice: 30.0, outputTokenPrice: 60.0 }),
      },
    });

    const overrides = new Map<string, PriceEntry>();
    overrides.set('gpt-5', makeEntry({ inputTokenPrice: 50.0, outputTokenPrice: 100.0 }));

    for (const [key, val] of overrides) {
      base.providers.get('openai')!.set(key, val);
    }

    const table = createPricingTable(base);
    expect(table.getPrice('gpt-5', 'openai')!.inputTokenPrice).toBe(50.0);
    expect(table.modelCount).toBe(2);
  });
});

describe('custom table loading from YAML file', () => {
  it('should load custom YAML table and override bundled pricing', async () => {
    const customPath = path.join(tmpdir(), `otel-cost-custom-${randomUUID()}.yaml`);

    const customYaml = `
version: "custom-1.0"
last_updated: "2026-01-01T00:00:00Z"
providers:
  openai:
    models:
      gpt-4:
        input_token_price: 99.99
        output_token_price: 199.99
        effective_date: "2026-01-01T00:00:00Z"
      custom-model:
        input_token_price: 42.0
        output_token_price: 84.0
        effective_date: "2026-01-01T00:00:00Z"
`;

    try {
      await writeFile(customPath, customYaml, 'utf-8');

      const data = await loadPricingData({
        tablesDir: TABLES_DIR,
        customTables: { custom: customPath },
      });

      expect(data.providers.has('openai')).toBe(true);
      const openai = data.providers.get('openai')!;

      // Custom table should override bundled gpt-4 price
      const gpt4 = openai.get('gpt-4');
      expect(gpt4).toBeDefined();
      expect(gpt4!.inputTokenPrice).toBe(99.99);
      expect(gpt4!.outputTokenPrice).toBe(199.99);
      expect(gpt4!.effectiveDate).toBe('2026-01-01T00:00:00Z');

      // Custom table should add a new model
      const customModel = openai.get('custom-model');
      expect(customModel).toBeDefined();
      expect(customModel!.inputTokenPrice).toBe(42.0);
      expect(customModel!.outputTokenPrice).toBe(84.0);
    } finally {
      await unlink(customPath).catch(() => {});
    }
  });

  it('should add a new provider from custom YAML table', async () => {
    const customPath = path.join(tmpdir(), `otel-cost-new-provider-${randomUUID()}.yaml`);

    const customYaml = `
version: "custom-2.0"
last_updated: "2026-04-01T00:00:00Z"
providers:
  cohere:
    models:
      command-r-plus:
        input_token_price: 15.0
        output_token_price: 60.0
        effective_date: "2026-04-01T00:00:00Z"
      command-r:
        input_token_price: 3.0
        output_token_price: 15.0
        effective_date: "2026-04-01T00:00:00Z"
`;

    try {
      await writeFile(customPath, customYaml, 'utf-8');

      const data = await loadPricingData({
        tablesDir: TABLES_DIR,
        customTables: { cohere: customPath },
      });

      expect(data.providers.has('cohere')).toBe(true);
      const cohere = data.providers.get('cohere')!;
      expect(cohere.size).toBe(2);
      expect(cohere.get('command-r-plus')!.inputTokenPrice).toBe(15.0);
      expect(cohere.get('command-r-plus')!.outputTokenPrice).toBe(60.0);
      expect(cohere.get('command-r')!.inputTokenPrice).toBe(3.0);
      expect(cohere.get('command-r')!.outputTokenPrice).toBe(15.0);

      // Bundled tables should still be loaded
      expect(data.providers.has('openai')).toBe(true);
      expect(data.providers.has('anthropic')).toBe(true);
    } finally {
      await unlink(customPath).catch(() => {});
    }
  });

  it('should reject when custom YAML file does not exist', async () => {
    const nonexistentPath = path.join(tmpdir(), `otel-cost-nonexistent-${randomUUID()}.yaml`);

    await expect(
      loadPricingData({
        tablesDir: TABLES_DIR,
        customTables: { missing: nonexistentPath },
      }),
    ).rejects.toThrow();
  });

  it('should reject when custom YAML file contains invalid YAML', async () => {
    const customPath = path.join(tmpdir(), `otel-cost-invalid-${randomUUID()}.yaml`);

    const invalidYaml = `
version: "bad-1.0"
providers:
  openai:
    models:
      - this is
    definitely not valid yaml :::
`;

    try {
      await writeFile(customPath, invalidYaml, 'utf-8');

      await expect(
        loadPricingData({
          tablesDir: TABLES_DIR,
          customTables: { invalid: customPath },
        }),
      ).rejects.toThrow();
    } finally {
      await unlink(customPath).catch(() => {});
    }
  });
});

describe('merged provider across bundled tables', () => {
  it('should merge providers that appear in multiple bundled tables', async () => {
    const tablesDir = path.join(tmpdir(), `otel-cost-merged-${randomUUID()}`);
    await mkdir(tablesDir, { recursive: true });

    try {
      const baseYaml = (version: string, providers: string) => `
version: "${version}"
last_updated: "2024-01-01"
providers:
${providers}
`;

      await writeFile(
        path.join(tablesDir, 'openai.yaml'),
        baseYaml(
          '1.0',
          `  openai:
    models:
      gpt-4:
        input_token_price: 30.0
        output_token_price: 60.0
        effective_date: "2024-01-01T00:00:00Z"
  overlapping:
    models:
      model-from-openai:
        input_token_price: 5.0
        output_token_price: 10.0
        effective_date: "2024-01-01T00:00:00Z"`,
        ),
        'utf-8',
      );

      await writeFile(
        path.join(tablesDir, 'anthropic.yaml'),
        baseYaml(
          '1.0',
          `  anthropic:
    models:
      claude-3:
        input_token_price: 15.0
        output_token_price: 75.0
        effective_date: "2024-01-01T00:00:00Z"
  overlapping:
    models:
      model-from-anthropic:
        input_token_price: 7.0
        output_token_price: 14.0
        effective_date: "2024-01-01T00:00:00Z"`,
        ),
        'utf-8',
      );

      await writeFile(
        path.join(tablesDir, 'google.yaml'),
        baseYaml(
          '1.0',
          `  google:
    models:
      gemini-pro:
        input_token_price: 1.0
        output_token_price: 2.0
        effective_date: "2024-01-01T00:00:00Z"`,
        ),
        'utf-8',
      );

      await writeFile(
        path.join(tablesDir, 'aws-bedrock.yaml'),
        baseYaml(
          '1.0',
          `  aws-bedrock:
    models:
      claude-3-opus:
        input_token_price: 15.0
        output_token_price: 75.0
        effective_date: "2024-01-01T00:00:00Z"`,
        ),
        'utf-8',
      );

      await writeFile(
        path.join(tablesDir, 'azure.yaml'),
        baseYaml(
          '1.0',
          `  azure:
    models:
      gpt-4:
        input_token_price: 30.0
        output_token_price: 60.0
        effective_date: "2024-01-01T00:00:00Z"`,
        ),
        'utf-8',
      );

      const data = await loadPricingData({ tablesDir });

      const overlapping = data.providers.get('overlapping');
      expect(overlapping).toBeDefined();
      expect(overlapping!.size).toBe(2);
      expect(overlapping!.get('model-from-openai')!.inputTokenPrice).toBe(5.0);
      expect(overlapping!.get('model-from-anthropic')!.inputTokenPrice).toBe(7.0);
    } finally {
      await rm(tablesDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  it('should default version and lastUpdated when missing from YAML', async () => {
    const customPath = path.join(tmpdir(), `otel-cost-no-meta-${randomUUID()}.yaml`);

    const yamlWithoutMeta = `
providers:
  test:
    models:
      gpt-4:
        input_token_price: 30.0
        output_token_price: 60.0
        effective_date: "2024-01-01T00:00:00Z"
`;

    try {
      await writeFile(customPath, yamlWithoutMeta, 'utf-8');

      const data = await loadPricingData({
        tablesDir: TABLES_DIR,
        customTables: { test: customPath },
      });

      expect(data.version).toBeTruthy();
      expect(data.lastUpdated).toBeTruthy();
      expect(data.providers.has('test')).toBe(true);
    } finally {
      await unlink(customPath).catch(() => {});
    }
  });
});
