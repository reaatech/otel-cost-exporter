import { readFile } from 'node:fs/promises';
import { DEFAULT_CONFIG } from '@reaatech/otel-cost-exporter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('pino', () => {
  return {
    default: vi.fn((opts: Record<string, unknown>) => ({
      level: (opts.level as string) ?? 'info',
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      fatal: vi.fn(),
      trace: vi.fn(),
      silent: vi.fn(),
      child: vi.fn(() => ({ info: vi.fn(), error: vi.fn() })),
    })),
  };
});

const mockedReadFile = vi.mocked(readFile);

async function importLoader() {
  type LoaderModule = typeof import('@reaatech/otel-cost-exporter');
  return vi.importActual('@reaatech/otel-cost-exporter') as Promise<LoaderModule>;
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('loadConfig', () => {
  let envSnapshot: NodeJS.ProcessEnv;

  beforeEach(() => {
    envSnapshot = { ...process.env };
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    process.env = envSnapshot;
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('defaults', () => {
    it('should return the default config when no path or env vars are set', async () => {
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.pricing.autoUpdate).toBe(true);
      expect(config.pricing.updateInterval).toBe('24h');
      expect(config.metrics.prefix).toBe('llm_cost');
      expect(config.metrics.labels).toEqual({});
      expect(config.export.format).toBe('prometheus');
      expect(config.logging.level).toBe('info');
      expect(config.logging.format).toBe('json');
    });

    it('should return a config structurally matching DEFAULT_CONFIG', async () => {
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      const defaults = deepClone(DEFAULT_CONFIG);

      expect(config.pricing.autoUpdate).toBe(defaults.pricing.autoUpdate);
      expect(config.pricing.updateInterval).toBe(defaults.pricing.updateInterval);
      expect(config.metrics.prefix).toBe(defaults.metrics.prefix);
      expect(config.export.format).toBe(defaults.export.format);
      expect(config.logging.level).toBe(defaults.logging.level);
      expect(config.logging.format).toBe(defaults.logging.format);
    });
  });

  describe('YAML file merging', () => {
    it('should deep-merge YAML config on top of defaults', async () => {
      mockedReadFile.mockResolvedValue(`
pricing:
  autoUpdate: false
  updateInterval: "48h"
logging:
  level: debug
`);

      const { loadConfig } = await importLoader();
      const config = await loadConfig('/fake/path/config.yaml');

      expect(config.pricing.autoUpdate).toBe(false);
      expect(config.pricing.updateInterval).toBe('48h');
      expect(config.logging.level).toBe('debug');
      expect(config.metrics.prefix).toBe('llm_cost');
      expect(config.export.format).toBe('prometheus');
    });

    it('should merge nested objects without overwriting siblings', async () => {
      mockedReadFile.mockResolvedValue(`
metrics:
  prefix: "custom"
`);

      const { loadConfig } = await importLoader();
      const config = await loadConfig('/fake/path/config.yaml');

      expect(config.metrics.prefix).toBe('custom');
      expect(config.metrics.labels).toEqual({});
    });
  });

  describe('environment variable overrides', () => {
    it('should override pricing.customTablePath from OTEL_COST_PRICING_CUSTOM_TABLE_PATH', async () => {
      vi.stubEnv('OTEL_COST_PRICING_CUSTOM_TABLE_PATH', '/custom/pricing.yaml');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.pricing.customTablePath).toBe('/custom/pricing.yaml');
    });

    it('should override pricing.autoUpdate from OTEL_COST_PRICING_AUTO_UPDATE (true)', async () => {
      vi.stubEnv('OTEL_COST_PRICING_AUTO_UPDATE', 'true');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.pricing.autoUpdate).toBe(true);
    });

    it('should override pricing.autoUpdate from OTEL_COST_PRICING_AUTO_UPDATE (false)', async () => {
      vi.stubEnv('OTEL_COST_PRICING_AUTO_UPDATE', 'false');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.pricing.autoUpdate).toBe(false);
    });

    it('should ignore invalid OTEL_COST_PRICING_AUTO_UPDATE values', async () => {
      vi.stubEnv('OTEL_COST_PRICING_AUTO_UPDATE', 'not-a-bool');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.pricing.autoUpdate).toBe(DEFAULT_CONFIG.pricing.autoUpdate);
    });

    it('should override pricing.updateInterval from OTEL_COST_PRICING_UPDATE_INTERVAL', async () => {
      vi.stubEnv('OTEL_COST_PRICING_UPDATE_INTERVAL', '12h');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.pricing.updateInterval).toBe('12h');
    });

    it('should override pricing.updateURL from OTEL_COST_PRICING_UPDATE_URL', async () => {
      vi.stubEnv('OTEL_COST_PRICING_UPDATE_URL', 'https://example.com/pricing');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.pricing.updateURL).toBe('https://example.com/pricing');
    });

    it('should override pricing.defaultPrice from OTEL_COST_PRICING_DEFAULT_PRICE', async () => {
      vi.stubEnv('OTEL_COST_PRICING_DEFAULT_PRICE', '42.5');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.pricing.defaultPrice).toBe(42.5);
    });

    it('should ignore invalid OTEL_COST_PRICING_DEFAULT_PRICE values', async () => {
      vi.stubEnv('OTEL_COST_PRICING_DEFAULT_PRICE', 'not-a-number');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.pricing.defaultPrice).toBeUndefined();
    });

    it('should override metrics.prefix from OTEL_COST_METRICS_PREFIX', async () => {
      vi.stubEnv('OTEL_COST_METRICS_PREFIX', 'custom_prefix');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.metrics.prefix).toBe('custom_prefix');
    });

    it('should override metrics.labels from OTEL_COST_METRICS_LABELS', async () => {
      vi.stubEnv('OTEL_COST_METRICS_LABELS', '{"env":"prod","region":"us-east-1"}');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.metrics.labels).toEqual({ env: 'prod', region: 'us-east-1' });
    });

    it('should ignore invalid JSON in OTEL_COST_METRICS_LABELS', async () => {
      vi.stubEnv('OTEL_COST_METRICS_LABELS', '{invalid json}');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.metrics.labels).toEqual({});
    });

    it('should ignore OTEL_COST_METRICS_LABELS that is not an object', async () => {
      vi.stubEnv('OTEL_COST_METRICS_LABELS', '[1, 2, 3]');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.metrics.labels).toEqual({});
    });

    it('should override export.format from OTEL_COST_EXPORT_FORMAT', async () => {
      vi.stubEnv('OTEL_COST_EXPORT_FORMAT', 'otlp');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.export.format).toBe('otlp');
    });

    it('should ignore invalid OTEL_COST_EXPORT_FORMAT values', async () => {
      vi.stubEnv('OTEL_COST_EXPORT_FORMAT', 'invalid-format');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.export.format).toBe(DEFAULT_CONFIG.export.format);
    });

    it('should override export.interval from OTEL_COST_EXPORT_INTERVAL', async () => {
      vi.stubEnv('OTEL_COST_EXPORT_INTERVAL', '30s');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.export.interval).toBe('30s');
    });

    it('should override export.endpoint from OTEL_COST_EXPORT_ENDPOINT', async () => {
      vi.stubEnv('OTEL_COST_EXPORT_ENDPOINT', 'https://otel.example.com');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.export.endpoint).toBe('https://otel.example.com');
    });

    it('should override logging.level from OTEL_COST_LOG_LEVEL', async () => {
      vi.stubEnv('OTEL_COST_LOG_LEVEL', 'debug');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.logging.level).toBe('debug');
    });

    it('should ignore invalid OTEL_COST_LOG_LEVEL values', async () => {
      vi.stubEnv('OTEL_COST_LOG_LEVEL', 'verbose');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.logging.level).toBe(DEFAULT_CONFIG.logging.level);
    });

    it('should override logging.format from OTEL_COST_LOG_FORMAT', async () => {
      vi.stubEnv('OTEL_COST_LOG_FORMAT', 'text');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.logging.format).toBe('text');
    });

    it('should ignore invalid OTEL_COST_LOG_FORMAT values', async () => {
      vi.stubEnv('OTEL_COST_LOG_FORMAT', 'xml');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.logging.format).toBe(DEFAULT_CONFIG.logging.format);
    });

    it('should apply multiple env vars simultaneously', async () => {
      vi.stubEnv('OTEL_COST_METRICS_PREFIX', 'multi');
      vi.stubEnv('OTEL_COST_LOG_LEVEL', 'warn');
      vi.stubEnv('OTEL_COST_PRICING_AUTO_UPDATE', 'false');

      const { loadConfig } = await importLoader();
      const config = await loadConfig();

      expect(config.metrics.prefix).toBe('multi');
      expect(config.logging.level).toBe('warn');
      expect(config.pricing.autoUpdate).toBe(false);
      expect(config.export.format).toBe(DEFAULT_CONFIG.export.format);
    });
  });

  describe('ConfigSchema validation', () => {
    it('should pass a valid config through schema validation', async () => {
      vi.stubEnv('OTEL_COST_PRICING_AUTO_UPDATE', 'false');
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.pricing.autoUpdate).toBe(false);
    });

    it('should strip unknown top-level keys via schema validation', async () => {
      mockedReadFile.mockResolvedValue(`
pricing:
  autoUpdate: false
unknown_section:
  foo: bar
`);

      const { loadConfig } = await importLoader();
      const config = await loadConfig('/fake/path/config.yaml');
      expect((config as unknown as Record<string, unknown>).unknown_section).toBeUndefined();
    });

    it('should apply schema defaults for missing optional fields', async () => {
      const { loadConfig } = await importLoader();
      const config = await loadConfig();
      expect(config.export.interval).toBe('60s');
    });
  });
});

describe('createLogger', () => {
  it('should create a pino logger with json format by default', async () => {
    const { createLogger } = await import('@reaatech/otel-cost-exporter-core');
    const logger = createLogger('info', 'json');
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should create a pino logger with pretty transport when format is not json', async () => {
    const { createLogger } = await import('@reaatech/otel-cost-exporter-core');
    const logger = createLogger('debug', 'text');
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
  });

  it('should respect log level parameter', async () => {
    const { createLogger } = await import('@reaatech/otel-cost-exporter-core');
    const logger = createLogger('warn', 'json');
    expect(logger).toBeDefined();
    expect(logger.level).toBe('warn');
  });
});
