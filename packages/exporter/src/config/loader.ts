import { readFile } from 'node:fs/promises';
import { ConfigSchema } from '@reaatech/otel-cost-exporter-core';
import { parse as parseYaml } from 'yaml';
import type { Config } from './config.js';
import { DEFAULT_CONFIG } from './config.js';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const output = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    if (isObject(sourceVal) && isObject(output[key])) {
      output[key] = deepMerge(
        output[key] as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else {
      output[key] = sourceVal;
    }
  }

  return output;
}

function applyEnvOverrides(config: Config): void {
  const env = process.env;

  if (env.OTEL_COST_PRICING_CUSTOM_TABLE_PATH !== undefined) {
    config.pricing.customTablePath = env.OTEL_COST_PRICING_CUSTOM_TABLE_PATH;
  }

  if (env.OTEL_COST_PRICING_AUTO_UPDATE !== undefined) {
    const val = env.OTEL_COST_PRICING_AUTO_UPDATE.toLowerCase();
    if (val === 'true' || val === 'false') {
      config.pricing.autoUpdate = val === 'true';
    }
  }

  if (env.OTEL_COST_PRICING_UPDATE_INTERVAL !== undefined) {
    config.pricing.updateInterval = env.OTEL_COST_PRICING_UPDATE_INTERVAL;
  }

  if (env.OTEL_COST_PRICING_UPDATE_URL !== undefined) {
    config.pricing.updateURL = env.OTEL_COST_PRICING_UPDATE_URL;
  }

  if (env.OTEL_COST_PRICING_DEFAULT_PRICE !== undefined) {
    const val = Number.parseFloat(env.OTEL_COST_PRICING_DEFAULT_PRICE);
    if (!Number.isNaN(val)) {
      config.pricing.defaultPrice = val;
    }
  }

  if (env.OTEL_COST_METRICS_PREFIX !== undefined) {
    config.metrics.prefix = env.OTEL_COST_METRICS_PREFIX;
  }

  if (env.OTEL_COST_METRICS_LABELS !== undefined) {
    try {
      const labels: unknown = JSON.parse(env.OTEL_COST_METRICS_LABELS);
      if (typeof labels === 'object' && labels !== null && !Array.isArray(labels)) {
        config.metrics.labels = labels as Record<string, string>;
      }
    } catch {}
  }

  if (env.OTEL_COST_EXPORT_FORMAT !== undefined) {
    const format = env.OTEL_COST_EXPORT_FORMAT;
    if (format === 'prometheus' || format === 'otlp' || format === 'json') {
      config.export.format = format;
    }
  }

  if (env.OTEL_COST_EXPORT_INTERVAL !== undefined) {
    config.export.interval = env.OTEL_COST_EXPORT_INTERVAL;
  }

  if (env.OTEL_COST_EXPORT_ENDPOINT !== undefined) {
    config.export.endpoint = env.OTEL_COST_EXPORT_ENDPOINT;
  }

  if (env.OTEL_COST_LOG_LEVEL !== undefined) {
    const level = env.OTEL_COST_LOG_LEVEL;
    if (level === 'debug' || level === 'info' || level === 'warn' || level === 'error') {
      config.logging.level = level;
    }
  }

  if (env.OTEL_COST_LOG_FORMAT !== undefined) {
    const format = env.OTEL_COST_LOG_FORMAT;
    if (format === 'json' || format === 'text') {
      config.logging.format = format;
    }
  }
}

export async function loadConfig(configPath?: string): Promise<Config> {
  let config = deepMerge({}, DEFAULT_CONFIG as unknown as Record<string, unknown>);

  if (configPath !== undefined) {
    const yamlContent = await readFile(configPath, 'utf-8');
    const yamlConfig = parseYaml(yamlContent) as Record<string, unknown>;
    config = deepMerge(config, yamlConfig);
  }

  applyEnvOverrides(config as unknown as Config);

  const result = ConfigSchema.parse(config);
  return result;
}
