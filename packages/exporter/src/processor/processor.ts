import type { CostCalculator, CostResult } from '@reaatech/otel-cost-exporter-calculator';
import type { CostSpan } from '@reaatech/otel-cost-exporter-core';

export interface SpanProcessor {
  processSpans(spans: readonly CostSpan[]): Promise<ProcessResult[]>;
  processSpan(span: CostSpan): ProcessResult;
  shutdown(): Promise<void>;
}

export interface ProcessResult {
  spanId: string;
  cost: CostResult;
  error?: string;
}

export interface SpanProcessorDeps {
  readonly calculator: CostCalculator;
}

export function createSpanProcessor(deps: SpanProcessorDeps): SpanProcessor {
  return {
    processSpan(span: CostSpan): ProcessResult {
      try {
        const cost = deps.calculator.calculate(span.model, span.inputTokens, span.outputTokens, {
          provider: span.provider,
          cacheReadTokens: span.cacheReadTokens,
          cacheCreationTokens: span.cacheCreationTokens,
        });

        return { spanId: span.spanId, cost };
      } catch (err) {
        return {
          spanId: span.spanId,
          cost: {
            model: span.model,
            provider: span.provider,
            inputTokens: span.inputTokens,
            outputTokens: span.outputTokens,
            cacheReadTokens: span.cacheReadTokens ?? 0,
            cacheCreationTokens: span.cacheCreationTokens ?? 0,
            inputCostUsd: 0,
            outputCostUsd: 0,
            cacheReadCostUsd: 0,
            cacheCreationCostUsd: 0,
            totalCostUsd: 0,
          },
          error: (err as Error).message,
        };
      }
    },

    async processSpans(spans: readonly CostSpan[]): Promise<ProcessResult[]> {
      return spans.map((span) => this.processSpan(span));
    },

    async shutdown(): Promise<void> {},
  };
}
