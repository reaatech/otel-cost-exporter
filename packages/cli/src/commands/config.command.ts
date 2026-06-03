/* eslint-disable no-console */

import type { Config } from '@reaatech/otel-cost-exporter';

import { DEFAULT_CONFIG, loadConfig } from '@reaatech/otel-cost-exporter';
import { stringify as stringifyYaml } from 'yaml';

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
