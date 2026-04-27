/* eslint-disable no-console */

import { stringify as stringifyYaml } from 'yaml';

import { DEFAULT_CONFIG } from '@/config/config.js';
import { loadConfig } from '@/config/loader.js';
import type { Config } from '@/config/config.js';

export interface ConfigCommandOptions {
  format: 'json' | 'yaml';
}

export async function configCommand(options: ConfigCommandOptions): Promise<void> {
  const config: Config = await loadConfig();

  const output: Record<string, unknown> = {
    default: { ...DEFAULT_CONFIG },
    active: { ...config },
  };

  if (options.format === 'yaml') {
    console.log(stringifyYaml(output));
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}
