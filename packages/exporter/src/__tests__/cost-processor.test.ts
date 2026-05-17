import type { IResource } from '@opentelemetry/resources';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import type {
  SpanProcessor as OtelSpanProcessor,
  ReadableSpan,
} from '@opentelemetry/sdk-trace-base';
import type { SpanProcessor as CostSpanProcessor } from '@reaatech/otel-cost-exporter';
import { createCostMetricReader, createCostSpanProcessor } from '@reaatech/otel-cost-exporter';
import {
  GEN_AI_REQUEST_MODEL,
  GEN_AI_SYSTEM,
  GEN_AI_USAGE_INPUT_TOKENS,
  GEN_AI_USAGE_OUTPUT_TOKENS,
} from '@reaatech/otel-cost-exporter-core';
import type { Logger } from 'pino';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function makeResource(attrs: Record<string, string> = {}): IResource {
  const resource: IResource = {
    attributes: attrs,
    merge(other: IResource | null): IResource {
      return makeResource({
        ...attrs,
        ...((other?.attributes as Record<string, string> | undefined) ?? {}),
      });
    },
  };
  return resource;
}

function makeOtelSpan(overrides: Partial<ReadableSpan> = {}): ReadableSpan {
  return {
    name: 'chat gpt-4',
    kind: 1,
    spanContext: () => ({
      traceId: '00000000000000000000000000000001',
      spanId: '0000000000000002',
      traceFlags: 0,
    }),
    parentSpanId: '0000000000000003',
    startTime: [1700000000, 0],
    endTime: [1700000001, 500_000_000],
    status: { code: 1 },
    attributes: {
      [GEN_AI_SYSTEM]: 'openai',
      [GEN_AI_REQUEST_MODEL]: 'gpt-4',
      [GEN_AI_USAGE_INPUT_TOKENS]: 1000,
      [GEN_AI_USAGE_OUTPUT_TOKENS]: 500,
    },
    links: [],
    events: [],
    duration: [1, 500_000_000],
    ended: true,
    resource: makeResource(),
    instrumentationLibrary: {
      name: 'test',
      version: '1.0',
      schemaUrl: '',
    },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
    ...overrides,
  };
}

function makeNonGenAiSpan(): ReadableSpan {
  return makeOtelSpan({
    name: 'http GET /api/users',
    attributes: {
      'http.method': 'GET',
      'http.status_code': 200,
    },
  });
}

describe('createCostSpanProcessor', () => {
  let otelProcessor: OtelSpanProcessor;
  let processSpanFn: ReturnType<typeof vi.fn>;
  let shutdownFn: ReturnType<typeof vi.fn>;
  let mockLogger: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    processSpanFn = vi.fn();
    shutdownFn = vi.fn().mockResolvedValue(undefined);
    mockLogger = { error: vi.fn() };

    const mockCostProcessor: CostSpanProcessor = {
      processSpan: processSpanFn as unknown as CostSpanProcessor['processSpan'],
      processSpans: vi.fn(),
      shutdown: shutdownFn as unknown as CostSpanProcessor['shutdown'],
    };
    otelProcessor = createCostSpanProcessor({
      costProcessor: mockCostProcessor,
      logger: mockLogger as unknown as Logger,
    });
  });

  describe('onStart', () => {
    it('should be a no-op and not throw', () => {
      expect(() =>
        otelProcessor.onStart(
          {} as unknown as Parameters<typeof otelProcessor.onStart>[0],
          {} as unknown as Parameters<typeof otelProcessor.onStart>[1],
        ),
      ).not.toThrow();
    });
  });

  describe('onEnd', () => {
    it('should convert a GenAI span and delegate to costProcessor.processSpan', () => {
      const otelSpan = makeOtelSpan();
      otelProcessor.onEnd(otelSpan);

      expect(processSpanFn).toHaveBeenCalledTimes(1);
      const costSpan = processSpanFn.mock.calls[0][0];
      expect(costSpan.provider).toBe('openai');
      expect(costSpan.model).toBe('gpt-4');
      expect(costSpan.inputTokens).toBe(1000);
      expect(costSpan.outputTokens).toBe(500);
    });

    it('should skip non-GenAI spans without calling costProcessor', () => {
      const otelSpan = makeNonGenAiSpan();
      otelProcessor.onEnd(otelSpan);

      expect(processSpanFn).not.toHaveBeenCalled();
    });

    it('should not throw on conversion errors', () => {
      const brokenSpan = makeOtelSpan();
      Object.assign(brokenSpan, {
        spanContext: () => {
          throw new Error('spanContext unavailable');
        },
      });

      expect(() => otelProcessor.onEnd(brokenSpan)).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should not throw when costProcessor.processSpan throws', () => {
      processSpanFn.mockImplementation(() => {
        throw new Error('cost calculation failed');
      });
      const otelSpan = makeOtelSpan();

      expect(() => otelProcessor.onEnd(otelSpan)).not.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should not throw when span is null', () => {
      expect(() => otelProcessor.onEnd(null as unknown as ReadableSpan)).not.toThrow();
    });

    it('should not throw when span has undefined attributes', () => {
      const span = makeOtelSpan({ attributes: undefined });
      expect(() => otelProcessor.onEnd(span)).not.toThrow();
    });

    it('should process Anthropic spans with cache tokens', () => {
      const otelSpan = makeOtelSpan({
        attributes: {
          [GEN_AI_SYSTEM]: 'anthropic',
          [GEN_AI_REQUEST_MODEL]: 'claude-3-opus-20240229',
          [GEN_AI_USAGE_INPUT_TOKENS]: 1_000_000,
          [GEN_AI_USAGE_OUTPUT_TOKENS]: 500_000,
          'gen_ai.usage.cache_read_input_tokens': 200_000,
          'gen_ai.usage.cache_creation_input_tokens': 100_000,
        },
      });
      otelProcessor.onEnd(otelSpan);

      const costSpan = processSpanFn.mock.calls[0][0];
      expect(costSpan.provider).toBe('anthropic');
      expect(costSpan.model).toBe('claude-3-opus-20240229');
      expect(costSpan.cacheReadTokens).toBe(200_000);
      expect(costSpan.cacheCreationTokens).toBe(100_000);
    });

    it('should process spans with error status', () => {
      const otelSpan = makeOtelSpan({
        status: { code: 2, message: 'LLM timeout' },
      });
      otelProcessor.onEnd(otelSpan);

      const costSpan = processSpanFn.mock.calls[0][0];
      expect(costSpan.status).toBe('error');
      expect(costSpan.errorMessage).toBe('LLM timeout');
    });
  });

  describe('shutdown', () => {
    it('should delegate shutdown to the cost processor', async () => {
      await otelProcessor.shutdown();
      expect(shutdownFn).toHaveBeenCalledTimes(1);
    });

    it('should propagate shutdown rejection', async () => {
      const shutdownError = new Error('shutdown failed');
      shutdownFn.mockRejectedValue(shutdownError);

      await expect(otelProcessor.shutdown()).rejects.toThrow('shutdown failed');
    });
  });

  describe('forceFlush', () => {
    it('should resolve immediately without calling costProcessor', async () => {
      await expect(otelProcessor.forceFlush()).resolves.toBeUndefined();
    });
  });
});

describe('createCostMetricReader', () => {
  it('should create a CostMetricReaderResult with a working metricsBuilder', () => {
    const meterProvider = new MeterProvider();
    const result = createCostMetricReader({ meterProvider });

    expect(result.metricsBuilder).toBeDefined();
    expect(typeof result.metricsBuilder.recordCost).toBe('function');
    expect(typeof result.shutdown).toBe('function');

    result.metricsBuilder.recordCost({
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
    });
  });

  it('should use metric prefix when provided', () => {
    const meterProvider = new MeterProvider();
    const result = createCostMetricReader({
      meterProvider,
      prefix: 'my_service',
    });

    expect(result.metricsBuilder).toBeDefined();
    result.metricsBuilder.recordCost({
      model: 'claude-3-opus-20240229',
      provider: 'anthropic',
      inputTokens: 100,
      outputTokens: 200,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      inputCostUsd: 0.0015,
      outputCostUsd: 0.015,
      cacheReadCostUsd: 0,
      cacheCreationCostUsd: 0,
      totalCostUsd: 0.0165,
    });
  });

  it('should pass extra labels to recordCost', () => {
    const meterProvider = new MeterProvider();
    const result = createCostMetricReader({
      meterProvider,
      extraLabels: { environment: 'staging' },
    });

    // recordCost should accept labels without error
    result.metricsBuilder.recordCost(
      {
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
      },
      { environment: 'production' },
    );
  });

  it('should shutdown the meter provider', async () => {
    const meterProvider = new MeterProvider();
    const result = createCostMetricReader({ meterProvider });

    await expect(result.shutdown()).resolves.toBeUndefined();
  });
});
