import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config/config.js';
import type { Config } from '../../src/config/config.js';

vi.mock('node:fs', () => {
  return {
    watch: vi.fn(() => {
      return { close: vi.fn() };
    }),
  };
});

vi.mock('node:fs/promises', () => {
  return {
    stat: vi.fn(),
  };
});

vi.mock('../../src/config/loader.js', () => {
  return {
    loadConfig: vi.fn(),
  };
});

const { loadConfig } = await import('../../src/config/loader.js');
const mockedLoadConfig = vi.mocked(loadConfig);

async function importWatcher() {
  const mod = await import('../../src/config/watcher.js');
  return { createConfigService: mod.createConfigService };
}

describe('createConfigService', () => {
  let initialConfig: Config;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    initialConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as Config;
    mockedLoadConfig.mockResolvedValue(initialConfig);
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
      mockedLoadConfig.mockResolvedValue(updated);

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
