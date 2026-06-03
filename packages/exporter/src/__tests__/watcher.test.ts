import type { Config } from '@reaatech/otel-cost-exporter';
import { DEFAULT_CONFIG } from '@reaatech/otel-cost-exporter';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    watch: vi.fn(() => {
      return { close: vi.fn() };
    }),
  };
});

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    stat: vi.fn(),
  };
});

vi.mock('../config/loader.js', () => ({
  loadConfig: vi.fn(),
}));

async function importWatcher() {
  const mod = await import('../config/watcher.js');
  return { createConfigService: mod.createConfigService };
}

const { loadConfig: mockedLoadConfig } = await import('../config/loader.js');

describe('createConfigService', () => {
  let initialConfig: Config;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    initialConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Config;
    (mockedLoadConfig as ReturnType<typeof vi.fn>).mockResolvedValue(initialConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSnapshot', () => {
    it('should return the initial config', async () => {
      const { createConfigService } = await importWatcher();
      const svc = createConfigService(initialConfig);
      expect(svc.getSnapshot()).toEqual(initialConfig);
    });
  });

  describe('reload', () => {
    it('should reload and update the snapshot', async () => {
      const { createConfigService } = await importWatcher();
      const svc = createConfigService(initialConfig);

      const updated: Config = {
        ...initialConfig,
        logging: { ...initialConfig.logging, level: 'debug' as const },
      };
      (mockedLoadConfig as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      await svc.reload();
      expect(svc.getSnapshot().logging.level).toBe('debug');
    });

    it('should pass configPath to loadConfig on reload', async () => {
      const { createConfigService } = await importWatcher();
      const svc = createConfigService(initialConfig, '/path/to/config.yaml');

      await svc.reload();
      expect(mockedLoadConfig).toHaveBeenCalledWith('/path/to/config.yaml');
    });

    it('should call loadConfig without path when configPath is undefined', async () => {
      const { createConfigService } = await importWatcher();
      const svc = createConfigService(initialConfig);

      await svc.reload();
      expect(mockedLoadConfig).toHaveBeenCalledWith(undefined);
    });
  });

  describe('startWatching / stopWatching', () => {
    it('should not throw when stopWatching is called without startWatching', async () => {
      const { createConfigService } = await importWatcher();
      const svc = createConfigService(initialConfig);
      expect(() => svc.stopWatching()).not.toThrow();
    });

    it('should not start watching when configPath is undefined', async () => {
      const { createConfigService } = await importWatcher();
      const svc = createConfigService(initialConfig);
      svc.startWatching();
      svc.stopWatching();
    });

    it('should not start watching twice', async () => {
      const { createConfigService } = await importWatcher();
      const svc = createConfigService(initialConfig, '/path/to/config.yaml');
      svc.startWatching();
      svc.startWatching();
      svc.stopWatching();
    });
  });
});
