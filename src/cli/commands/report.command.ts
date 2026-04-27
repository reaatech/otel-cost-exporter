/* eslint-disable no-console */

import { readFile } from 'node:fs/promises';

import { createLogger } from '@/utils/logger.js';
import { loadConfig } from '@/config/loader.js';
import { createProcessorFactory } from '@/processor/factory.js';
import type { SpanProcessor } from '@/processor/processor.js';
import type { CostSpan } from '@/types/domain.js';
import type { Config } from '@/config/config.js';
import { CostSpanSchema } from '@/types/schemas.js';

export interface ReportCommandOptions {
  input?: string;
  format: 'json' | 'table';
  environment?: string;
}

function formatTable(
  results: Array<{ spanId: string; cost: ReturnType<SpanProcessor['processSpan']>['cost'] }>,
): string {
  const header =
    'spanId'.padEnd(20) +
    'Model'.padEnd(30) +
    'Provider'.padEnd(15) +
    'In Tok'.padEnd(10) +
    'Out Tok'.padEnd(10) +
    'Total USD';

  const lines = [header, '-'.repeat(header.length)];

  for (const r of results) {
    lines.push(
      r.spanId.padEnd(20) +
        r.cost.model.padEnd(30) +
        r.cost.provider.padEnd(15) +
        String(r.cost.inputTokens).padEnd(10) +
        String(r.cost.outputTokens).padEnd(10) +
        r.cost.totalCostUsd.toFixed(6),
    );
  }

  return lines.join('\n');
}

export async function reportCommand(options: ReportCommandOptions): Promise<void> {
  const config: Config = await loadConfig();
  const logger = createLogger(config.logging.level, config.logging.format);

  let raw: string;

  if (options.input) {
    raw = await readFile(options.input, 'utf-8');
  } else if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
      chunks.push(Buffer.from(chunk));
    }
    raw = Buffer.concat(chunks).toString('utf-8');
  } else {
    logger.error('No input provided. Use --input <file> or pipe JSON via stdin.');
    process.exit(1);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.error('Invalid JSON input');
    process.exit(1);
  }

  if (!Array.isArray(parsed)) {
    logger.error('Input must be a JSON array of CostSpan objects');
    process.exit(1);
  }

  const spans: CostSpan[] = [];
  for (const item of parsed) {
    const validated = CostSpanSchema.parse(item);
    spans.push(validated);
  }

  if (options.environment) {
    const filtered = spans.filter((s) => s.telemetry.environment === options.environment);
    if (filtered.length === 0) {
      logger.warn({ environment: options.environment }, 'No spans found for environment');
    }
    spans.length = 0;
    spans.push(...filtered);
  }

  const factory = createProcessorFactory(config);
  const processor: SpanProcessor = await factory.createProcessor();
  const results = await processor.processSpans(spans);

  if (options.format === 'table') {
    console.log(formatTable(results));
  } else {
    const costs = results.map((r) => ({
      spanId: r.spanId,
      model: r.cost.model,
      provider: r.cost.provider,
      inputTokens: r.cost.inputTokens,
      outputTokens: r.cost.outputTokens,
      cacheReadTokens: r.cost.cacheReadTokens,
      cacheCreationTokens: r.cost.cacheCreationTokens,
      inputCostUsd: r.cost.inputCostUsd,
      outputCostUsd: r.cost.outputCostUsd,
      cacheReadCostUsd: r.cost.cacheReadCostUsd,
      cacheCreationCostUsd: r.cost.cacheCreationCostUsd,
      totalCostUsd: r.cost.totalCostUsd,
      error: r.error,
    }));
    console.log(JSON.stringify(costs, null, 2));
  }

  await processor.shutdown();
}
