import { SpanStatusCode } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';

import type { CostSpan } from '@reaatech/otel-cost-exporter-core';
import {
  GEN_AI_REQUEST_MODEL,
  GEN_AI_SYSTEM,
  GEN_AI_USAGE_CACHE_CREATION_TOKENS,
  GEN_AI_USAGE_CACHE_READ_TOKENS,
  GEN_AI_USAGE_INPUT_TOKENS,
  GEN_AI_USAGE_OUTPUT_TOKENS,
} from '@reaatech/otel-cost-exporter-core';

function hrTimeToDate(hrTime: [number, number]): Date {
  return new Date(hrTime[0] * 1000 + hrTime[1] / 1e6);
}

function hrTimeToMs(hrTime: [number, number]): number {
  return hrTime[0] * 1000 + hrTime[1] / 1e6;
}

function parseIntAttribute(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function spanToCostSpan(span: ReadableSpan): CostSpan | null {
  const attrs = span.attributes;

  const provider = attrs[GEN_AI_SYSTEM] as string | undefined;
  const model = attrs[GEN_AI_REQUEST_MODEL] as string | undefined;
  const rawInputTokens = attrs[GEN_AI_USAGE_INPUT_TOKENS];
  const rawOutputTokens = attrs[GEN_AI_USAGE_OUTPUT_TOKENS];

  if (!provider || !model) {
    return null;
  }

  if (rawInputTokens === undefined && rawOutputTokens === undefined) {
    return null;
  }

  const inputTokens = parseIntAttribute(rawInputTokens);
  const outputTokens = parseIntAttribute(rawOutputTokens);

  const cacheReadTokensRaw = attrs[GEN_AI_USAGE_CACHE_READ_TOKENS];
  const cacheCreationTokensRaw = attrs[GEN_AI_USAGE_CACHE_CREATION_TOKENS];

  const resourceAttrs = span.resource.attributes;
  const serviceName = (resourceAttrs?.['service.name'] as string | undefined) ?? '';

  const spanContext = span.spanContext();
  const startHr = span.startTime;
  const endHr = span.endTime;
  const startTime = hrTimeToDate(startHr);
  const endTime = hrTimeToDate(endHr);
  const durationMs = hrTimeToMs(endHr) - hrTimeToMs(startHr);
  const isError = span.status.code === SpanStatusCode.ERROR;

  return {
    spanId: spanContext.spanId,
    traceId: spanContext.traceId,
    provider,
    model,
    inputTokens,
    outputTokens,
    cacheReadTokens:
      cacheReadTokensRaw !== undefined ? parseIntAttribute(cacheReadTokensRaw) : undefined,
    cacheCreationTokens:
      cacheCreationTokensRaw !== undefined ? parseIntAttribute(cacheCreationTokensRaw) : undefined,
    costUsd: 0,
    costBreakdown: {
      inputCostUsd: 0,
      outputCostUsd: 0,
    },
    telemetry: {
      environment: (resourceAttrs?.['deployment.environment'] as string | undefined) ?? '',
      ns: (resourceAttrs?.['service.namespace'] as string | undefined) ?? '',
      service: serviceName,
    },
    timestamp: new Date(),
    startTime,
    endTime,
    durationMs,
    status: isError ? 'error' : 'success',
    errorMessage: isError ? (span.status.message ?? '') : undefined,
  };
}
