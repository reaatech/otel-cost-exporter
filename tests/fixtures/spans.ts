import type { CostSpan } from '@reaatech/otel-cost-exporter-core';

export function createSampleSpan(overrides: Partial<CostSpan> = {}): CostSpan {
  return {
    spanId: 'test-span-001',
    traceId: 'test-trace-001',
    provider: 'openai',
    model: 'gpt-4',
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: 0.06,
    costBreakdown: {
      inputCostUsd: 0.03,
      outputCostUsd: 0.03,
    },
    telemetry: {
      environment: 'test-env',
      ns: 'test-namespace',
      service: 'test-service',
    },
    timestamp: new Date('2024-01-01T00:00:00Z'),
    startTime: new Date('2024-01-01T00:00:00Z'),
    endTime: new Date('2024-01-01T00:00:01Z'),
    durationMs: 1000,
    status: 'success',
    ...overrides,
  };
}

export function createMultiProviderSpans(): CostSpan[] {
  return [
    createSampleSpan({ provider: 'openai', model: 'gpt-4' }),
    createSampleSpan({ provider: 'anthropic', model: 'claude-3-opus-20240229' }),
    createSampleSpan({ provider: 'google', model: 'gemini-pro' }),
  ];
}
