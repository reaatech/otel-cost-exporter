import type { Resource } from '@opentelemetry/resources';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { spanToCostSpan } from '@reaatech/otel-cost-exporter';
import {
  GEN_AI_REQUEST_MODEL,
  GEN_AI_SYSTEM,
  GEN_AI_USAGE_CACHE_CREATION_TOKENS,
  GEN_AI_USAGE_CACHE_READ_TOKENS,
  GEN_AI_USAGE_INPUT_TOKENS,
  GEN_AI_USAGE_OUTPUT_TOKENS,
} from '@reaatech/otel-cost-exporter-core';
import { describe, expect, it } from 'vitest';

function makeResource(attrs: Record<string, string> = {}): Resource {
  return { attributes: attrs } as Resource;
}

function makeSpan(overrides: Partial<ReadableSpan> = {}): ReadableSpan {
  const base: ReadableSpan = {
    name: 'chat gpt-4',
    kind: 1,
    spanContext: () => ({
      traceId: '00000000000000000000000000000001',
      spanId: '0000000000000002',
      traceFlags: 0,
    }),
    parentSpanContext: {
      traceId: '00000000000000000000000000000001',
      spanId: '0000000000000003',
      traceFlags: 0,
    },
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
    instrumentationScope: {
      name: 'test',
      version: '1.0',
      schemaUrl: '',
    },
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0,
    ...overrides,
  };
  return base;
}

describe('spanToCostSpan', () => {
  it('should convert a ReadableSpan with full gen_ai attributes into a CostSpan', () => {
    const span = makeSpan();
    const result = spanToCostSpan(span);

    expect(result).not.toBeNull();
    expect(result?.spanId).toBe('0000000000000002');
    expect(result?.traceId).toBe('00000000000000000000000000000001');
    expect(result?.provider).toBe('openai');
    expect(result?.model).toBe('gpt-4');
    expect(result?.inputTokens).toBe(1000);
    expect(result?.outputTokens).toBe(500);
    expect(result?.status).toBe('success');
    expect(result?.errorMessage).toBeUndefined();
    expect(result?.startTime).toBeInstanceOf(Date);
    expect(result?.endTime).toBeInstanceOf(Date);
    expect(result?.durationMs).toBeCloseTo(1500, 0);
    expect(result?.costUsd).toBe(0);
    expect(result?.costBreakdown).toEqual({ inputCostUsd: 0, outputCostUsd: 0 });
  });

  it('should return null for span without gen_ai attributes', () => {
    const span = makeSpan({
      attributes: { 'some.other': 'value' },
    });
    const result = spanToCostSpan(span);
    expect(result).toBeNull();
  });

  it('should return null for span missing gen_ai.system', () => {
    const span = makeSpan({
      attributes: {
        [GEN_AI_REQUEST_MODEL]: 'gpt-4',
        [GEN_AI_USAGE_INPUT_TOKENS]: 1000,
      },
    });
    const result = spanToCostSpan(span);
    expect(result).toBeNull();
  });

  it('should return null for span missing gen_ai.request.model', () => {
    const span = makeSpan({
      attributes: {
        [GEN_AI_SYSTEM]: 'openai',
        [GEN_AI_USAGE_OUTPUT_TOKENS]: 500,
      },
    });
    const result = spanToCostSpan(span);
    expect(result).toBeNull();
  });

  it('should return a CostSpan when only input tokens are present', () => {
    const span = makeSpan({
      attributes: {
        [GEN_AI_SYSTEM]: 'openai',
        [GEN_AI_REQUEST_MODEL]: 'gpt-4',
        [GEN_AI_USAGE_INPUT_TOKENS]: 1000,
      },
    });
    const result = spanToCostSpan(span);
    expect(result).not.toBeNull();
    expect(result?.inputTokens).toBe(1000);
    expect(result?.outputTokens).toBe(0);
  });

  it('should return a CostSpan when only output tokens are present', () => {
    const span = makeSpan({
      attributes: {
        [GEN_AI_SYSTEM]: 'anthropic',
        [GEN_AI_REQUEST_MODEL]: 'claude-3-opus-20240229',
        [GEN_AI_USAGE_OUTPUT_TOKENS]: 500,
      },
    });
    const result = spanToCostSpan(span);
    expect(result).not.toBeNull();
    expect(result?.inputTokens).toBe(0);
    expect(result?.outputTokens).toBe(500);
  });

  it('should include cache read tokens from attributes', () => {
    const span = makeSpan({
      attributes: {
        [GEN_AI_SYSTEM]: 'anthropic',
        [GEN_AI_REQUEST_MODEL]: 'claude-3-opus-20240229',
        [GEN_AI_USAGE_INPUT_TOKENS]: 1000,
        [GEN_AI_USAGE_OUTPUT_TOKENS]: 500,
        [GEN_AI_USAGE_CACHE_READ_TOKENS]: 300,
      },
    });
    const result = spanToCostSpan(span);
    expect(result?.cacheReadTokens).toBe(300);
  });

  it('should include cache creation tokens from attributes', () => {
    const span = makeSpan({
      attributes: {
        [GEN_AI_SYSTEM]: 'anthropic',
        [GEN_AI_REQUEST_MODEL]: 'claude-3-opus-20240229',
        [GEN_AI_USAGE_INPUT_TOKENS]: 1000,
        [GEN_AI_USAGE_OUTPUT_TOKENS]: 500,
        [GEN_AI_USAGE_CACHE_CREATION_TOKENS]: 150,
      },
    });
    const result = spanToCostSpan(span);
    expect(result?.cacheCreationTokens).toBe(150);
  });

  it('should handle error status and set errorMessage', () => {
    const span = makeSpan({
      status: { code: 2, message: 'Rate limit exceeded' },
    });
    const result = spanToCostSpan(span);
    expect(result?.status).toBe('error');
    expect(result?.errorMessage).toBe('Rate limit exceeded');
  });

  it('should handle error status without message', () => {
    const span = makeSpan({
      status: { code: 2 },
    });
    const result = spanToCostSpan(span);
    expect(result?.status).toBe('error');
    expect(result?.errorMessage).toBe('');
  });

  it('should handle string token values via parseInt', () => {
    const span = makeSpan({
      attributes: {
        [GEN_AI_SYSTEM]: 'openai',
        [GEN_AI_REQUEST_MODEL]: 'gpt-4',
        [GEN_AI_USAGE_INPUT_TOKENS]: '4096',
        [GEN_AI_USAGE_OUTPUT_TOKENS]: '2048',
      },
    });
    const result = spanToCostSpan(span);
    expect(result?.inputTokens).toBe(4096);
    expect(result?.outputTokens).toBe(2048);
  });

  it('should handle invalid string token values gracefully', () => {
    const span = makeSpan({
      attributes: {
        [GEN_AI_SYSTEM]: 'openai',
        [GEN_AI_REQUEST_MODEL]: 'gpt-4',
        [GEN_AI_USAGE_INPUT_TOKENS]: 'invalid',
        [GEN_AI_USAGE_OUTPUT_TOKENS]: 'also-invalid',
      },
    });
    const result = spanToCostSpan(span);
    expect(result?.inputTokens).toBe(0);
    expect(result?.outputTokens).toBe(0);
  });

  it('should extract service name from resource attributes', () => {
    const span = makeSpan({
      resource: makeResource({ 'service.name': 'my-llm-service' }),
    });
    const result = spanToCostSpan(span);
    expect(result?.telemetry.service).toBe('my-llm-service');
  });

  it('should have empty telemetry when no resource attributes set', () => {
    const span = makeSpan();
    const result = spanToCostSpan(span);
    expect(result?.telemetry.environment).toBe('');
    expect(result?.telemetry.service).toBe('');
  });

  it('should compute durationMs from HrTime correctly', () => {
    const span = makeSpan({
      startTime: [1700000000, 0],
      endTime: [1700000002, 250_000_000],
    });
    const result = spanToCostSpan(span);
    expect(result?.durationMs).toBeCloseTo(2250, 0);
  });

  it('should handle sub-second duration correctly', () => {
    const span = makeSpan({
      startTime: [1700000000, 0],
      endTime: [1700000000, 350_000_000],
    });
    const result = spanToCostSpan(span);
    expect(result?.durationMs).toBeCloseTo(350, 0);
  });

  it('should return null when both input and output tokens are undefined', () => {
    const span = makeSpan({
      attributes: {
        [GEN_AI_SYSTEM]: 'openai',
        [GEN_AI_REQUEST_MODEL]: 'gpt-4',
      },
    });
    const result = spanToCostSpan(span);
    expect(result).toBeNull();
  });

  it('should extract deployment.environment as telemetry environment', () => {
    const span = makeSpan({
      resource: makeResource({ 'deployment.environment': 'production' }),
    });
    const result = spanToCostSpan(span);
    expect(result?.telemetry.environment).toBe('production');
  });

  it('should extract service.namespace as telemetry ns', () => {
    const span = makeSpan({
      resource: makeResource({ 'service.namespace': 'llm-gateway' }),
    });
    const result = spanToCostSpan(span);
    expect(result?.telemetry.ns).toBe('llm-gateway');
  });

  it('should handle span with null/undefined resource attributes gracefully', () => {
    const span = makeSpan({
      resource: makeResource({}),
    });
    const result = spanToCostSpan(span);
    expect(result?.telemetry.environment).toBe('');
    expect(result?.telemetry.ns).toBe('');
    expect(result?.telemetry.service).toBe('');
  });
});
