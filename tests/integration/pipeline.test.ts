import { describe, it, expect, beforeEach } from 'vitest';
import path from 'node:path';

import { loadPricingData } from '../../src/pricing/loader.js';
import { createPricingTable } from '../../src/pricing/table.js';
import type { PricingTable } from '../../src/pricing/table.js';
import { createPricingCache } from '../../src/calculator/cache.js';
import type { PricingCache } from '../../src/calculator/cache.js';
import { createModelNormalizer } from '../../src/calculator/normalizer.js';
import { createCostCalculator } from '../../src/calculator/engine.js';
import type { CostCalculator } from '../../src/calculator/engine.js';
import { createSpanProcessor } from '../../src/processor/processor.js';
import type { SpanProcessor, ProcessResult } from '../../src/processor/processor.js';
import type { CostSpan } from '../../src/types/domain.js';
import { createSampleSpan } from '../fixtures/spans.js';

const TABLES_DIR = path.resolve(import.meta.dirname, '../../pricing-tables');

describe('end-to-end pipeline', () => {
  let processor: SpanProcessor;
  let calculator: CostCalculator;
  let pricingTable: PricingTable;
  let cache: PricingCache;

  beforeEach(async () => {
    const data = await loadPricingData({ tablesDir: TABLES_DIR });
    pricingTable = createPricingTable(data);
    cache = createPricingCache();
    const normalizer = createModelNormalizer();
    calculator = createCostCalculator({
      pricing: pricingTable,
      cache,
      normalizer,
    });
    processor = createSpanProcessor({ calculator });
  });

  it('should process a real GPT-4 span and produce correct cost', () => {
    const span: CostSpan = createSampleSpan({
      model: 'gpt-4',
      provider: 'openai',
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      spanId: 'gpt4-full-span',
    });

    const result: ProcessResult = processor.processSpan(span);

    expect(result.spanId).toBe('gpt4-full-span');
    expect(result.error).toBeUndefined();
    expect(result.cost.model).toBe('gpt-4');
    expect(result.cost.provider).toBe('openai');
    expect(result.cost.inputCostUsd).toBeCloseTo(30.0, 6);
    expect(result.cost.outputCostUsd).toBeCloseTo(30.0, 6);
    expect(result.cost.totalCostUsd).toBeCloseTo(60.0, 6);
  });

  it('should process a Claude span with cache tokens and produce correct cost', () => {
    const span: CostSpan = createSampleSpan({
      model: 'claude-3-opus-20240229',
      provider: 'anthropic',
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      cacheReadTokens: 200_000,
      cacheCreationTokens: 100_000,
      spanId: 'claude-full-span',
    });

    const result: ProcessResult = processor.processSpan(span);

    expect(result.spanId).toBe('claude-full-span');
    expect(result.error).toBeUndefined();
    expect(result.cost.model).toBe('claude-3-opus-20240229');
    expect(result.cost.provider).toBe('anthropic');
    expect(result.cost.cacheReadTokens).toBe(200_000);
    expect(result.cost.cacheCreationTokens).toBe(100_000);
    expect(result.cost.cacheReadCostUsd).toBeCloseTo(0.3, 6);
    expect(result.cost.cacheCreationCostUsd).toBeCloseTo(1.875, 6);
    expect(result.cost.inputCostUsd).toBeCloseTo(12.0, 6);
    expect(result.cost.outputCostUsd).toBeCloseTo(37.5, 6);
    expect(result.cost.totalCostUsd).toBeCloseTo(51.675, 6);
  });

  it('should process unknown model using default price', () => {
    const defaultCalc: CostCalculator = createCostCalculator({
      pricing: pricingTable,
      cache: createPricingCache(),
      normalizer: createModelNormalizer(),
      defaultPrice: 0.001,
    });
    const defaultProcessor: SpanProcessor = createSpanProcessor({
      calculator: defaultCalc,
    });

    const span: CostSpan = createSampleSpan({
      model: 'some-future-model',
      provider: 'unknown',
      inputTokens: 1_000_000,
      outputTokens: 500_000,
      spanId: 'unknown-span',
    });

    const result: ProcessResult = defaultProcessor.processSpan(span);

    expect(result.spanId).toBe('unknown-span');
    expect(result.error).toBeUndefined();
    expect(result.cost.provider).toBe('unknown');
    expect(result.cost.inputCostUsd).toBeCloseTo(0.001, 6);
    expect(result.cost.outputCostUsd).toBeCloseTo(0.0005, 6);
    expect(result.cost.totalCostUsd).toBeCloseTo(0.0015, 6);
  });

  it('should process a batch of 3 different provider spans', async () => {
    const spans: CostSpan[] = [
      createSampleSpan({
        provider: 'openai',
        model: 'gpt-4',
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        spanId: 'openai-span',
      }),
      createSampleSpan({
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        spanId: 'anthropic-span',
      }),
      createSampleSpan({
        provider: 'google_genai',
        model: 'gemini-pro',
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        spanId: 'google-span',
      }),
    ];

    const results: ProcessResult[] = await processor.processSpans(spans);

    expect(results).toHaveLength(3);

    const openaiResult = results[0];
    expect(openaiResult.spanId).toBe('openai-span');
    expect(openaiResult.cost.provider).toBe('openai');
    expect(openaiResult.cost.model).toBe('gpt-4');
    expect(openaiResult.cost.totalCostUsd).toBeCloseTo(60.0, 6);

    const anthropicResult = results[1];
    expect(anthropicResult.cost.provider).toBe('anthropic');
    expect(anthropicResult.cost.model).toBe('claude-3-opus-20240229');
    expect(anthropicResult.cost.totalCostUsd).toBeCloseTo(52.5, 6);

    const googleResult = results[2];
    expect(googleResult.cost.provider).toBe('google');
    expect(googleResult.cost.model).toBe('gemini-1.5-pro');
    expect(googleResult.cost.totalCostUsd).toBeCloseTo(8.75, 6);

    results.forEach((r) => {
      expect(r.error).toBeUndefined();
    });
  });

  it('should not break existing calculations after pricing table update', async () => {
    const span: CostSpan = createSampleSpan({
      model: 'gpt-4',
      provider: 'openai',
      inputTokens: 1_000_000,
      outputTokens: 500_000,
    });

    const beforeResult: ProcessResult = processor.processSpan(span);
    expect(beforeResult.cost.totalCostUsd).toBeCloseTo(60.0, 6);

    await pricingTable.update();

    const afterResult: ProcessResult = processor.processSpan(span);
    expect(afterResult.cost.totalCostUsd).toBeCloseTo(60.0, 6);
    expect(afterResult.cost.model).toBe('gpt-4');
    expect(afterResult.cost.provider).toBe('openai');
    expect(afterResult.error).toBeUndefined();
  });
});
