export interface PricingConfig {
  customTablePath?: string;
  autoUpdate: boolean;
  updateInterval: string;
  updateURL?: string;
  defaultPrice?: number;
}

export interface MetricsConfig {
  prefix: string;
  labels: Record<string, string>;
}

export interface ExportConfig {
  format: 'prometheus' | 'otlp' | 'json';
  interval?: string;
  endpoint?: string;
  healthPort?: number;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'json' | 'text';
}

export interface Config {
  pricing: PricingConfig;
  metrics: MetricsConfig;
  export: ExportConfig;
  logging: LoggingConfig;
}

export const DEFAULT_CONFIG: Config = {
  pricing: {
    autoUpdate: true,
    updateInterval: '24h',
  },
  metrics: {
    prefix: 'llm_cost',
    labels: {},
  },
  export: {
    format: 'prometheus',
  },
  logging: {
    level: 'info',
    format: 'json',
  },
};
