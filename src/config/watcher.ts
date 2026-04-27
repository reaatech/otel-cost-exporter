import { watch } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { Config } from './config.js';
import { loadConfig } from './loader.js';
import type { Logger } from 'pino';

export interface ConfigService {
  getSnapshot(): Config;
  reload(): Promise<void>;
  startWatching(): void;
  stopWatching(): void;
}

const DEBOUNCE_MS = 500;

export function createConfigService(
  initial: Config,
  configPath?: string,
  logger?: Logger,
): ConfigService {
  let config: Config = initial;
  let watcher: ReturnType<typeof watch> | null = null;
  let watching = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    getSnapshot(): Config {
      return config;
    },

    async reload(): Promise<void> {
      const next = await loadConfig(configPath);
      config = next;
      logger?.info('Configuration reloaded');
    },

    startWatching(): void {
      if (!configPath || watching) return;

      const fsWatcher = watch(configPath, async (eventType) => {
        if (eventType === 'change') {
          if (debounceTimer !== null) {
            clearTimeout(debounceTimer);
          }
          debounceTimer = setTimeout(async () => {
            debounceTimer = null;
            try {
              const fileStat = await stat(configPath);
              if (!fileStat.isFile()) return;

              const next = await loadConfig(configPath);
              config = next;
              logger?.info('Configuration hot-reloaded from file change');
            } catch (err) {
              logger?.warn(
                { err },
                'Failed to reload config on file change — keeping current config',
              );
            }
          }, DEBOUNCE_MS);
        }
      });

      watching = true;
      watcher = fsWatcher;
    },

    stopWatching(): void {
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (watcher) {
        watcher.close();
        watcher = null;
      }
      watching = false;
    },
  };
}
