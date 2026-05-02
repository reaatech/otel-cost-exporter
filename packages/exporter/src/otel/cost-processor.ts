import type {
  SpanProcessor as OtelSpanProcessor,
  ReadableSpan,
} from '@opentelemetry/sdk-trace-base';
import type { Logger } from 'pino';

import type { CostResult } from '@reaatech/otel-cost-exporter-calculator';
import type { MetricsBuilder } from '../metrics/builder.js';
import type { SpanProcessor as CostSpanProcessor } from '../processor/processor.js';

import { logger as defaultLogger } from '@reaatech/otel-cost-exporter-core';
import { spanToCostSpan } from './span-adapter.js';

export interface CostSpanProcessorOptions {
  costProcessor: CostSpanProcessor;
  logger?: Logger;
  metricsBuilder?: MetricsBuilder;
  onSpanRecorded?: (result: CostResult) => void;
}

export function createCostSpanProcessor(options: CostSpanProcessorOptions): OtelSpanProcessor {
  const { costProcessor, logger = defaultLogger, metricsBuilder, onSpanRecorded } = options;

  return {
    onStart(_span, _parentContext): void {},

    onEnd(span: ReadableSpan): void {
      try {
        const costSpan = spanToCostSpan(span);
        if (!costSpan) return;

        const result = costProcessor.processSpan(costSpan);

        if (result.error) {
          logger.warn(
            { spanId: result.spanId, error: result.error },
            'Cost calculation error in span processor',
          );
          return;
        }

        metricsBuilder?.recordCost(result.cost);
        onSpanRecorded?.(result.cost);
      } catch (err) {
        logger.error({ err, spanName: span?.name }, 'Error processing OTel span for cost');
      }
    },

    async shutdown(): Promise<void> {
      await costProcessor.shutdown();
    },

    async forceFlush(): Promise<void> {},
  };
}
