export interface PriceEntry {
  inputTokenPrice: number;
  outputTokenPrice: number;
  cacheReadPrice?: number;
  cacheCreationPrice?: number;
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
  costUsd: number;
  costBreakdown: CostBreakdown;
  telemetry: TelemetryContext;
  timestamp: Date;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
}
