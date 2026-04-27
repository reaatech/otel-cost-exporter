import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

import { createSpanProcessor } from '../../src/processor/processor.js';
import type { SpanProcessor, ProcessResult } from '../../src/processor/processor.js';
import type { CostCalculator, CostResult } from '../../src/calculator/engine.js';
import type { CostSpan } from '../../src/types/domain.js';
import { createProcessorFactory } from '../../src/processor/factory.js';
import type { Config, PricingConfig } from '../../src/config/config.js';
import { DEFAULT_CONFIG } from '../../src/config/config.js';
import { createSampleSpan } from '../fixtures/spans.js';

function makeCostResult(overrides: Partial<CostResult> = {}): CostResult {
  return {
    model: 'gpt-4',
    provider: 'openai',
    inputTokens: 1000,
    outputTokens: 500,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    inputCostUsd: 0.03,
    outputCostUsd: 0.03,
    cacheReadCostUsd: 0,
    cacheCreationCostUsd: 0,
    totalCostUsd: 0.06,
    ...overrides,
  };
}

function makeClaudeCostResult(): CostResult {
  return {
    model: 'claude-3-opus-20240229',
    provider: 'anthropic',
    inputTokens: 1_000_000,
    outputTokens: 500_000,
    cacheReadTokens: 200_000,
    cacheCreationTokens: 100_000,
    inputCostUsd: 12.0,
    outputCostUsd: 37.5,
    cacheReadCostUsd: 0.3,
    cacheCreationCostUsd: 1.875,
    totalCostUsd: 54.675,
  };
}

describe('createSpanProcessor', () => {
  let processor: SpanProcessor;
  let mockCalculator: CostCalculator;
  let calculateFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    calculateFn = vi.fn();
    mockCalculator = { calculate: calculateFn as unknown as CostCalculator['calculate'] };
    processor = createSpanProcessor({ calculator: mockCalculator });
  });

  describe('processSpan', () => {
    it('should process a single span successfully', () => {
      const expectedResult = makeCostResult();
      calculateFn.mockReturnValue(expectedResult);
      const span = createSampleSpan();

      const result: ProcessResult = processor.processSpan(span);

      expect(result.spanId).toBe('test-span-001');
      expect(result.cost).toEqual(expectedResult);
      expect(result.error).toBeUndefined();
      expect(calculateFn).toHaveBeenCalledWith('gpt-4', 1000, 500, {
        provider: 'openai',
        cacheReadTokens: undefined,
        cacheCreationTokens: undefined,
      });
    });

    it('should process multiple spans and return an array of results', async () => {
      calculateFn.mockReturnValue(makeCostResult());
      const spans: CostSpan[] = [
        createSampleSpan({ spanId: 'span-1' }),
        createSampleSpan({ spanId: 'span-2' }),
        createSampleSpan({ spanId: 'span-3' }),
      ];

      const results: ProcessResult[] = await processor.processSpans(spans);

      expect(results).toHaveLength(3);
      expect(results[0].spanId).toBe('span-1');
      expect(results[1].spanId).toBe('span-2');
      expect(results[2].spanId).toBe('span-3');
      results.forEach((r) => {
        expect(r.error).toBeUndefined();
      });
      expect(calculateFn).toHaveBeenCalledTimes(3);
    });

    it('should handle pricing error for unknown model', () => {
      calculateFn.mockImplementation(() => {
        throw new Error('Unknown model: unknown-model');
      });
      const span = createSampleSpan({ model: 'unknown-model', spanId: 'bad-span' });

      const result: ProcessResult = processor.processSpan(span);

      expect(result.spanId).toBe('bad-span');
      expect(result.error).toBe('Unknown model: unknown-model');
      expect(result.cost.totalCostUsd).toBe(0);
      expect(result.cost.inputCostUsd).toBe(0);
      expect(result.cost.outputCostUsd).toBe(0);
    });

    it('should handle negative token counts', () => {
      calculateFn.mockImplementation(() => {
        throw new Error('Token counts must be non-negative');
      });
      const span = createSampleSpan({ inputTokens: -100, spanId: 'bad-tokens' });

      const result: ProcessResult = processor.processSpan(span);

      expect(result.spanId).toBe('bad-tokens');
      expect(result.error).toBe('Token counts must be non-negative');
    });

    it('should process spans with cache tokens for Anthropic models', () => {
      const claudeResult = makeClaudeCostResult();
      calculateFn.mockReturnValue(claudeResult);
      const span = createSampleSpan({
        model: 'claude-3-opus-20240229',
        provider: 'anthropic',
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        cacheReadTokens: 200_000,
        cacheCreationTokens: 100_000,
        spanId: 'claude-span',
      });

      const result: ProcessResult = processor.processSpan(span);

      expect(result.spanId).toBe('claude-span');
      expect(result.cost.model).toBe('claude-3-opus-20240229');
      expect(result.cost.provider).toBe('anthropic');
      expect(result.cost.cacheReadTokens).toBe(200_000);
      expect(result.cost.cacheCreationTokens).toBe(100_000);
      expect(result.cost.cacheReadCostUsd).toBe(0.3);
      expect(result.cost.cacheCreationCostUsd).toBe(1.875);
      expect(calculateFn).toHaveBeenCalledWith('claude-3-opus-20240229', 1_000_000, 500_000, {
        provider: 'anthropic',
        cacheReadTokens: 200_000,
        cacheCreationTokens: 100_000,
      });
    });

    it('should handle spans from different providers', () => {
      const openaiResult = makeCostResult({ provider: 'openai', model: 'gpt-4' });
      const anthropicResult = makeCostResult({
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
      });
      const googleResult = makeCostResult({ provider: 'google', model: 'gemini-pro' });

      calculateFn
        .mockReturnValueOnce(openaiResult)
        .mockReturnValueOnce(anthropicResult)
        .mockReturnValueOnce(googleResult);

      const openaiSpan = createSampleSpan({ spanId: 'openai-span' });
      const anthropicSpan = createSampleSpan({
        spanId: 'anthropic-span',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
      });
      const googleSpan = createSampleSpan({
        spanId: 'google-span',
        provider: 'google',
        model: 'gemini-pro',
      });

      const openaiProcessed = processor.processSpan(openaiSpan);
      const anthropicProcessed = processor.processSpan(anthropicSpan);
      const googleProcessed = processor.processSpan(googleSpan);

      expect(openaiProcessed.cost.provider).toBe('openai');
      expect(anthropicProcessed.cost.provider).toBe('anthropic');
      expect(googleProcessed.cost.provider).toBe('google');
      expect(openaiProcessed.error).toBeUndefined();
      expect(anthropicProcessed.error).toBeUndefined();
      expect(googleProcessed.error).toBeUndefined();
    });

    it('should not prevent other spans from processing when one errors', async () => {
      calculateFn
        .mockImplementationOnce(() => {
          throw new Error('Unknown model: bad-model');
        })
        .mockReturnValueOnce(makeCostResult({ model: 'gpt-4' }));

      const badSpan = createSampleSpan({ spanId: 'bad-span', model: 'bad-model' });
      const goodSpan = createSampleSpan({ spanId: 'good-span' });

      const results: ProcessResult[] = await processor.processSpans([badSpan, goodSpan]);

      expect(results).toHaveLength(2);
      expect(results[0].spanId).toBe('bad-span');
      expect(results[0].error).toBe('Unknown model: bad-model');
      expect(results[1].spanId).toBe('good-span');
      expect(results[1].error).toBeUndefined();
    });
  });

  describe('shutdown', () => {
    it('should complete shutdown without error', async () => {
      await expect(processor.shutdown()).resolves.toBeUndefined();
    });
  });
});

describe('createProcessorFactory', () => {
  it('should create a processor that can process spans', async () => {
    const config: Config = {
      ...DEFAULT_CONFIG,
      pricing: {
        ...DEFAULT_CONFIG.pricing,
        defaultPrice: 0.001,
      } as PricingConfig,
    };

    const factory = createProcessorFactory(config);
    const processor = await factory.createProcessor();

    expect(processor).toBeDefined();
    expect(typeof processor.processSpans).toBe('function');
    expect(typeof processor.processSpan).toBe('function');
    expect(typeof processor.shutdown).toBe('function');

    const span = createSampleSpan();
    const result = processor.processSpan(span);

    expect(result.spanId).toBe('test-span-001');
    expect(result.error).toBeUndefined();
    expect(result.cost.model).toBe('gpt-4');
    expect(result.cost.provider).toBe('openai');
    expect(result.cost.totalCostUsd).toBeGreaterThan(0);

    await expect(processor.shutdown()).resolves.toBeUndefined();
  });

  it('should throw when customTablePath points to a nonexistent file', async () => {
    const nonexistentPath = path.join(tmpdir(), `otel-cost-factory-test-${randomUUID()}.yaml`);

    const config: Config = {
      ...DEFAULT_CONFIG,
      pricing: {
        ...DEFAULT_CONFIG.pricing,
        customTablePath: nonexistentPath,
      } as PricingConfig,
    };

    const factory = createProcessorFactory(config);

    await expect(factory.createProcessor()).rejects.toThrow();
  });
});
