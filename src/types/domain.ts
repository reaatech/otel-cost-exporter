/**
 * Core domain types.
 *
 * @module types/domain
 */

export interface PriceEntry {
  /** Price per 1,000,000 input tokens in USD */
  inputTokenPrice: number;

  /** Price per 1,000,000 output tokens in USD */
  outputTokenPrice: number;

  /** Optional cache read price per 1,000,000 tokens (Anthropic) */
  cacheReadPrice?: number;

  /** Optional cache creation price per 1,000,000 tokens (Anthropic) */
  cacheCreationPrice?: number;

  /** ISO 8601 date when this pricing became effective */
  effectiveDate: string;
}

export interface CostBreakdown {
  inputCostUsd: number;
  outputCostUsd: number;
  cacheReadCostUsd?: number;
  cacheCreationCostUsd?: number;
}

export interface AggregationKey {
  model?: string;
  provider?: string;
  service?: string;
}

export interface TelemetryContext {
  environment?: string;
  ns?: string;
  service?: string;
}

export interface CostSpan {
  spanId: string;
  traceId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  /** Pre-calculated total cost in USD (may be 0 for spans not yet processed) */
  costUsd: number;
  /** Detailed cost breakdown (may be zeroed for spans not yet processed) */
  costBreakdown: CostBreakdown;
  telemetry: TelemetryContext;
  timestamp: Date;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
}
