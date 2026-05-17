import type { Config } from '@reaatech/otel-cost-exporter';
import { createCollectorService, DEFAULT_CONFIG } from '@reaatech/otel-cost-exporter';
import { describe, expect, it } from 'vitest';

describe('createCollectorService', () => {
  it('should create a collector service with start and shutdown methods', async () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      pricing: {
        ...DEFAULT_CONFIG.pricing,
        defaultPrice: 0.001,
      },
      export: {
        ...DEFAULT_CONFIG.export,
        format: 'prometheus',
      },
    };

    const service = await createCollectorService(config);

    expect(service).toBeDefined();
    expect(typeof service.start).toBe('function');
    expect(typeof service.shutdown).toBe('function');
  });

  it('should create a collector service with OTLP export format', async () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      pricing: {
        ...DEFAULT_CONFIG.pricing,
        defaultPrice: 0.001,
      },
      export: {
        format: 'otlp',
        endpoint: 'http://localhost:4318/v1/metrics',
      },
    };

    const service = await createCollectorService(config);

    expect(service).toBeDefined();
    expect(typeof service.start).toBe('function');
    expect(typeof service.shutdown).toBe('function');
  });

  it('should create a collector service with JSON export format', async () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      pricing: {
        ...DEFAULT_CONFIG.pricing,
        defaultPrice: 0.001,
      },
      export: {
        format: 'json',
      },
    };

    const service = await createCollectorService(config);

    expect(service).toBeDefined();
    expect(typeof service.start).toBe('function');
    expect(typeof service.shutdown).toBe('function');
  });

  it('should start and shut down cleanly with prometheus format', async () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      pricing: {
        ...DEFAULT_CONFIG.pricing,
        defaultPrice: 0.001,
      },
      export: {
        ...DEFAULT_CONFIG.export,
        format: 'prometheus',
      },
    };

    const service = await createCollectorService(config);

    await expect(service.start()).resolves.toBeUndefined();
    await expect(service.shutdown()).resolves.toBeUndefined();
  });

  it('should create collector with custom labels in metrics config', async () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      pricing: {
        ...DEFAULT_CONFIG.pricing,
        defaultPrice: 0.001,
      },
      metrics: {
        ...DEFAULT_CONFIG.metrics,
        prefix: 'test_llm',
        labels: { region: 'us-east-1', env: 'staging' },
      },
      export: {
        format: 'json',
      },
    };

    const service = await createCollectorService(config);
    expect(service).toBeDefined();
  });
});
