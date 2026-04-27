import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createBatchProcessor } from '../../src/processor/batch-processor.js';
import type { SpanProcessor, ProcessResult } from '../../src/processor/processor.js';
import type { CostSpan } from '../../src/types/domain.js';
import { createSampleSpan } from '../fixtures/spans.js';

function makeInner(): {
  inner: SpanProcessor;
  processSpanFn: ReturnType<typeof vi.fn>;
  processSpansFn: ReturnType<typeof vi.fn>;
  shutdownFn: ReturnType<typeof vi.fn>;
} {
  const processSpanFn = vi.fn();
  const processSpansFn = vi.fn();
  const shutdownFn = vi.fn();

  const inner: SpanProcessor = {
    processSpan: processSpanFn,
    processSpans: processSpansFn,
    shutdown: shutdownFn,
  };

  return { inner, processSpanFn, processSpansFn, shutdownFn };
}

describe('createBatchProcessor', () => {
  describe('processSpan', () => {
    it('should use default maxBatchSize when no options provided', () => {
      const { inner } = makeInner();
      const bp = createBatchProcessor(inner);

      const span = createSampleSpan();
      const result: ProcessResult = bp.processSpan(span);

      expect(result.spanId).toBe('test-span-001');
      expect(result.cost.totalCostUsd).toBe(0);
    });

    it('should add span to buffer', () => {
      const { inner, processSpansFn } = makeInner();
      const bp = createBatchProcessor(inner, { maxBatchSize: 3 });

      const span = createSampleSpan();
      const result: ProcessResult = bp.processSpan(span);

      expect(result.spanId).toBe('test-span-001');
      expect(result.cost.totalCostUsd).toBe(0);
      expect(processSpansFn).not.toHaveBeenCalled();
    });

    it('should flush when buffer reaches maxBatchSize', () => {
      const { inner, processSpansFn } = makeInner();
      processSpansFn.mockResolvedValue([]);
      const bp = createBatchProcessor(inner, { maxBatchSize: 2 });

      bp.processSpan(createSampleSpan({ spanId: 'span-1' }));
      expect(processSpansFn).not.toHaveBeenCalled();

      bp.processSpan(createSampleSpan({ spanId: 'span-2' }));
      expect(processSpansFn).toHaveBeenCalledTimes(1);
    });

    it('should return zero-cost result for buffered spans', () => {
      const { inner } = makeInner();
      const bp = createBatchProcessor(inner, { maxBatchSize: 10 });

      const result: ProcessResult = bp.processSpan(createSampleSpan());

      expect(result.spanId).toBe('test-span-001');
      expect(result.cost.inputCostUsd).toBe(0);
      expect(result.cost.outputCostUsd).toBe(0);
      expect(result.cost.totalCostUsd).toBe(0);
    });
  });

  describe('processSpans', () => {
    it('should add multiple spans to buffer', async () => {
      const { inner, processSpansFn } = makeInner();
      const bp = createBatchProcessor(inner, { maxBatchSize: 10 });

      const spans: CostSpan[] = [
        createSampleSpan({ spanId: 's1' }),
        createSampleSpan({ spanId: 's2' }),
        createSampleSpan({ spanId: 's3' }),
      ];

      const results: ProcessResult[] = await bp.processSpans(spans);

      expect(results).toHaveLength(3);
      expect(results[0].spanId).toBe('s1');
      expect(results[1].spanId).toBe('s2');
      expect(results[2].spanId).toBe('s3');
      results.forEach((r) => expect(r.cost.totalCostUsd).toBe(0));
      expect(processSpansFn).not.toHaveBeenCalled();
    });

    it('should flush when buffer exceeds maxBatchSize', async () => {
      const { inner, processSpansFn } = makeInner();
      processSpansFn.mockResolvedValue([]);
      const bp = createBatchProcessor(inner, { maxBatchSize: 2 });

      const spans: CostSpan[] = [
        createSampleSpan({ spanId: 's1' }),
        createSampleSpan({ spanId: 's2' }),
        createSampleSpan({ spanId: 's3' }),
      ];

      await bp.processSpans(spans);

      expect(processSpansFn).toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should flush remaining spans on shutdown', async () => {
      const { inner, processSpansFn, shutdownFn } = makeInner();
      processSpansFn.mockResolvedValue([]);
      shutdownFn.mockResolvedValue(undefined);

      const bp = createBatchProcessor(inner, { maxBatchSize: 10 });

      bp.processSpan(createSampleSpan({ spanId: 's1' }));
      bp.processSpan(createSampleSpan({ spanId: 's2' }));

      await bp.shutdown();

      expect(processSpansFn).toHaveBeenCalledTimes(1);
      expect(shutdownFn).toHaveBeenCalledTimes(1);
    });

    it('should call inner shutdown even when buffer is empty', async () => {
      const { inner, processSpansFn, shutdownFn } = makeInner();
      shutdownFn.mockResolvedValue(undefined);

      const bp = createBatchProcessor(inner, { maxBatchSize: 10 });
      await bp.shutdown();

      expect(processSpansFn).not.toHaveBeenCalled();
      expect(shutdownFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('timer', () => {
    let bp: SpanProcessor;
    let inner: SpanProcessor;
    let processSpansFn: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.useFakeTimers();
      const m = makeInner();
      inner = m.inner;
      processSpansFn = m.processSpansFn;
      processSpansFn.mockResolvedValue([]);
      bp = createBatchProcessor(inner, { maxBatchSize: 10, batchTimeoutMs: 100 });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should flush buffer when timer fires', async () => {
      bp.processSpan(createSampleSpan({ spanId: 'span-1' }));
      expect(processSpansFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      // Timer fires asynchronously, flush will complete
      await vi.runAllTimersAsync();
      expect(processSpansFn).toHaveBeenCalledTimes(1);
    });

    it('should clear timer on shutdown', async () => {
      bp.processSpan(createSampleSpan({ spanId: 'span-1' }));

      await bp.shutdown();

      expect(processSpansFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('should not crash when inner processSpans fails', () => {
      const { inner, processSpansFn } = makeInner();
      processSpansFn.mockRejectedValue(new Error('inner failure'));
      const bp = createBatchProcessor(inner, { maxBatchSize: 2 });

      bp.processSpan(createSampleSpan({ spanId: 's1' }));

      expect(() => {
        bp.processSpan(createSampleSpan({ spanId: 's2' }));
      }).not.toThrow();
    });

    it('should not crash when flushAsync inner processSpans fails during shutdown', async () => {
      const { inner, processSpansFn, shutdownFn } = makeInner();
      processSpansFn.mockRejectedValue(new Error('inner failure'));
      shutdownFn.mockResolvedValue(undefined);
      const bp = createBatchProcessor(inner, { maxBatchSize: 10 });

      bp.processSpan(createSampleSpan({ spanId: 's1' }));

      await expect(bp.shutdown()).resolves.toBeUndefined();
      expect(shutdownFn).toHaveBeenCalledTimes(1);
    });

    it('should not crash when inner processSpans fails during processSpans batch flush', async () => {
      const { inner, processSpansFn } = makeInner();
      processSpansFn.mockRejectedValue(new Error('inner failure'));
      const bp = createBatchProcessor(inner, { maxBatchSize: 2 });

      await expect(
        bp.processSpans([
          createSampleSpan({ spanId: 's1' }),
          createSampleSpan({ spanId: 's2' }),
          createSampleSpan({ spanId: 's3' }),
        ]),
      ).resolves.not.toThrow();
    });
  });

  describe('inner processor interaction', () => {
    it('should pass correct spans to inner on flush', async () => {
      const { inner, processSpansFn } = makeInner();
      processSpansFn.mockResolvedValue([]);
      const bp = createBatchProcessor(inner, { maxBatchSize: 3 });

      const s1 = createSampleSpan({ spanId: 's1' });
      const s2 = createSampleSpan({ spanId: 's2' });
      const s3 = createSampleSpan({ spanId: 's3' });

      bp.processSpan(s1);
      bp.processSpan(s2);
      bp.processSpan(s3);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(processSpansFn).toHaveBeenCalledWith(expect.arrayContaining([s1, s2, s3]));
    });
  });
});
