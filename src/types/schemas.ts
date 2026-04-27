import { z } from 'zod';
import type { PriceEntry, CostSpan } from './domain.js';

export const PriceEntrySchema = z.object({
  inputTokenPrice: z.number().positive(),
  outputTokenPrice: z.number().positive(),
  cacheReadPrice: z.number().positive().optional(),
  cacheCreationPrice: z.number().positive().optional(),
  effectiveDate: z.string().datetime(),
}) satisfies z.ZodType<PriceEntry>;

export const CostSpanSchema = z.object({
  spanId: z.string(),
  traceId: z.string(),
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative().optional(),
  cacheCreationTokens: z.number().int().nonnegative().optional(),
  costUsd: z.number().nonnegative(),
  costBreakdown: z.object({
    inputCostUsd: z.number().nonnegative(),
    outputCostUsd: z.number().nonnegative(),
    cacheReadCostUsd: z.number().nonnegative().optional(),
    cacheCreationCostUsd: z.number().nonnegative().optional(),
  }),
  telemetry: z.object({
    environment: z.string().optional(),
    ns: z.string().optional(),
    service: z.string().optional(),
  }),
  timestamp: z.coerce.date(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  durationMs: z.number().nonnegative(),
  status: z.enum(['success', 'error']),
  errorMessage: z.string().optional(),
}) satisfies z.ZodType<CostSpan>;

export const ConfigSchema = z.object({
  pricing: z.object({
    customTablePath: z.string().optional(),
    autoUpdate: z.boolean().default(true),
    updateInterval: z.string().default('24h'),
    updateURL: z.string().optional(),
    defaultPrice: z.number().positive().optional(),
  }),
  metrics: z.object({
    prefix: z.string().default('llm_cost'),
    labels: z.record(z.string()).default({}),
  }),
  export: z.object({
    format: z.enum(['prometheus', 'otlp', 'json']).default('prometheus'),
    interval: z.string().default('60s'),
    endpoint: z.string().optional(),
    healthPort: z.number().int().positive().optional(),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    format: z.enum(['json', 'text']).default('json'),
  }),
});
