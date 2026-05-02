import type { CostResult } from '@reaatech/otel-cost-exporter-calculator';
import type { CostSpan } from '@reaatech/otel-cost-exporter-core';
import type { ProcessResult, SpanProcessor } from './processor.js';

export interface BatchProcessorOptions {
  maxBatchSize?: number;
  batchTimeoutMs?: number;
  logger?: { warn(msg: string, ...args: unknown[]): void };
}

function noopLogger(): { warn(msg: string, ...args: unknown[]): void } {
  return {
    warn(): void {},
  };
}

function zeroCostResult(span: CostSpan): CostResult {
  return {
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
  };
}

export function createBatchProcessor(
  inner: SpanProcessor,
  options?: BatchProcessorOptions,
): SpanProcessor {
  const maxBatchSize = options?.maxBatchSize ?? 100;
  const batchTimeoutMs = options?.batchTimeoutMs ?? 5000;
  const log = options?.logger ?? noopLogger();

  const buffer: CostSpan[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  function startTimer(): void {
    if (timer !== null) return;
    if (buffer.length === 0) return;
    timer = setTimeout(() => {
      timer = null;
      flushAsync();
    }, batchTimeoutMs);
    timer.unref();
  }

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  async function flushAsync(): Promise<void> {
    clearTimer();
    if (buffer.length === 0) return;

    const batch = buffer.splice(0);
    try {
      await inner.processSpans(batch);
    } catch (err) {
      log.warn('Batch processor flush error:', (err as Error).message);
    }
  }

  return {
    processSpan(span: CostSpan): ProcessResult {
      buffer.push(span);

      if (buffer.length >= maxBatchSize) {
        const batch = buffer.splice(0);
        void inner.processSpans(batch).catch((err: unknown) => {
          log.warn('Batch processor async flush error:', (err as Error).message);
        });
      } else if (timer === null) {
        startTimer();
      }

      return {
        spanId: span.spanId,
        cost: zeroCostResult(span),
      };
    },

    async processSpans(spans: readonly CostSpan[]): Promise<ProcessResult[]> {
      for (const span of spans) {
        buffer.push(span);
      }

      if (buffer.length >= maxBatchSize) {
        await flushAsync();
      } else if (timer === null && buffer.length > 0) {
        startTimer();
      }

      return spans.map((span) => ({
        spanId: span.spanId,
        cost: zeroCostResult(span),
      }));
    },

    async shutdown(): Promise<void> {
      clearTimer();
      await flushAsync();
      await inner.shutdown();
    },
  };
}
