/**
 * otel-cost-exporter
 *
 * OpenTelemetry-native exporter that converts LLM span data into cost metrics
 * automatically, with bundled pricing tables for every major provider.
 *
 * @packageDocumentation
 */

export type { CostSpan, AggregationKey, PriceEntry, CostBreakdown } from './types/domain.js';
export { PriceEntrySchema, CostSpanSchema, ConfigSchema } from './types/schemas.js';

export type { Config, PricingConfig, MetricsConfig, ExportConfig } from './config/config.js';
export { DEFAULT_CONFIG } from './config/config.js';
export { loadConfig } from './config/loader.js';
export { createConfigService } from './config/watcher.js';
export type { ConfigService } from './config/watcher.js';

export type { PricingProvider } from './pricing/types.js';
export type { PricingTable } from './pricing/table.js';
export type { PricingTableData, LoaderOptions } from './pricing/loader.js';
export { createPricingTable } from './pricing/table.js';
export { loadPricingData } from './pricing/loader.js';

export { calculateCost } from './calculator/calculator.js';
export type { CalculatorDeps } from './calculator/calculator.js';
export { createCostCalculator, PricingError } from './calculator/engine.js';
export type { CostCalculator, CostCalculatorDeps, CostResult } from './calculator/engine.js';
export { createPricingCache } from './calculator/cache.js';
export type { PricingCache, CacheStats } from './calculator/cache.js';
export { createModelNormalizer } from './calculator/normalizer.js';
export type { ModelNormalizer, NormalizedModel } from './calculator/normalizer.js';

export { createSpanProcessor } from './processor/processor.js';
export type { SpanProcessor, ProcessResult, SpanProcessorDeps } from './processor/processor.js';
export { createBatchProcessor } from './processor/batch-processor.js';
export type { BatchProcessorOptions } from './processor/batch-processor.js';
export { createProcessorFactory } from './processor/factory.js';
export type { ProcessorFactory } from './processor/factory.js';

export { createMetricsBuilder } from './metrics/builder.js';
export type { MetricsBuilder } from './metrics/builder.js';
export { ALL_METRIC_NAMES } from './metrics/definitions.js';

export { createPrometheusExporter } from './exporter/prometheus.js';
export { createOtlpExporter } from './exporter/otlp.js';
export { createJsonExporter } from './exporter/json.js';
export type { MetricsExporter } from './exporter/types.js';

export { spanToCostSpan, createCostSpanProcessor, createCostMetricReader } from './otel/index.js';
export type { CostSpanProcessorOptions, CostMetricReaderResult } from './otel/index.js';

export { createLogger, logger } from './utils/logger.js';

export {
  GEN_AI_SYSTEM,
  GEN_AI_REQUEST_MODEL,
  GEN_AI_USAGE_INPUT_TOKENS,
  GEN_AI_USAGE_OUTPUT_TOKENS,
  GEN_AI_USAGE_CACHE_READ_TOKENS,
  GEN_AI_USAGE_CACHE_CREATION_TOKENS,
} from './semconv/attributes.js';
export { SEMCONV_VERSION } from './semconv/version.js';
