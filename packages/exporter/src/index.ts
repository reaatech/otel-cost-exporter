export type {
  Config,
  PricingConfig,
  MetricsConfig,
  ExportConfig,
  LoggingConfig,
} from './config/index.js';
export { DEFAULT_CONFIG, loadConfig, createConfigService } from './config/index.js';
export type { ConfigService } from './config/index.js';

export type {
  SpanProcessor,
  ProcessResult,
  SpanProcessorDeps,
  BatchProcessorOptions,
  ProcessorFactory,
} from './processor/index.js';
export {
  createSpanProcessor,
  createBatchProcessor,
  createProcessorFactory,
} from './processor/index.js';

export {
  METRIC_INPUT_COST,
  METRIC_OUTPUT_COST,
  METRIC_TOTAL_COST,
  ALL_METRIC_NAMES,
} from './metrics/index.js';
export type { MetricsBuilder } from './metrics/index.js';
export { createMetricsBuilder } from './metrics/index.js';

export type { MetricsExporter } from './exporters/index.js';
export {
  createPrometheusExporter,
  createOtlpExporter,
  createJsonExporter,
} from './exporters/index.js';

export type { CostSpanProcessorOptions, CostMetricReaderResult } from './otel/index.js';
export { createCostSpanProcessor, createCostMetricReader, spanToCostSpan } from './otel/index.js';

export type { CollectorService, DebugInfo, HealthServer } from './collector/index.js';
export { createCollectorService, createHealthServer } from './collector/index.js';
