import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MeterProvider } from '@opentelemetry/sdk-metrics';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  type MetricData,
  type ResourceMetrics,
} from '@opentelemetry/sdk-metrics';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

import { createMetricsBuilder } from '@reaatech/otel-cost-exporter';
import {
  METRIC_INPUT_COST,
  METRIC_OUTPUT_COST,
  METRIC_TOTAL_COST,
} from '@reaatech/otel-cost-exporter';
import type { MetricsBuilder } from '@reaatech/otel-cost-exporter';
import type { CostResult } from '@reaatech/otel-cost-exporter-calculator';

function makeResult(overrides?: Partial<CostResult>): CostResult {
  return {
    model: 'gpt-4',
    provider: 'openai',
    inputTokens: 1_000_000,
    outputTokens: 500_000,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    inputCostUsd: 30.0,
    outputCostUsd: 30.0,
    cacheReadCostUsd: 0,
    cacheCreationCostUsd: 0,
    totalCostUsd: 60.0,
    ...overrides,
  };
}

function findMetric(resourceMetrics: ResourceMetrics, name: string): MetricData | undefined {
  for (const scope of resourceMetrics.scopeMetrics) {
    for (const metric of scope.metrics) {
      if (metric.descriptor.name === name) {
        return metric;
      }
    }
  }
  return undefined;
}

describe('createMetricsBuilder', () => {
  describe('instrument creation', () => {
    it('should create all three Counter instruments', async () => {
      const meterProvider = new MeterProvider();
      const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
      const reader = new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: 100,
      });
      meterProvider.addMetricReader(reader);
      const meter = meterProvider.getMeter('test');

      const builder = createMetricsBuilder(meter);

      const result = makeResult();
      builder.recordCost(result);
      await reader.forceFlush();

      const metrics = exporter.getMetrics();
      expect(metrics.length).toBeGreaterThan(0);
      const firstMetrics = metrics[0];
      if (!firstMetrics) throw new Error('expected metrics');
      const inputMetric = findMetric(firstMetrics, METRIC_INPUT_COST);
      const outputMetric = findMetric(firstMetrics, METRIC_OUTPUT_COST);
      const totalMetric = findMetric(firstMetrics, METRIC_TOTAL_COST);

      expect(inputMetric).toBeDefined();
      expect(outputMetric).toBeDefined();
      expect(totalMetric).toBeDefined();
      await reader.shutdown();
    });

    it('should accept a prefix and prefix metric names', async () => {
      const meterProvider = new MeterProvider();
      const exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);

      const reader = new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: 100,
      });
      meterProvider.addMetricReader(reader);
      const meter = meterProvider.getMeter('test');

      const builder = createMetricsBuilder(meter, 'myapp');
      const result = makeResult({ inputCostUsd: 10.0, outputCostUsd: 5.0, totalCostUsd: 15.0 });
      builder.recordCost(result);

      await reader.forceFlush();
      const metrics = exporter.getMetrics();
      const firstMetrics = metrics[0];
      if (!firstMetrics) throw new Error('expected metrics');

      const prefixed = findMetric(firstMetrics, `myapp.${METRIC_INPUT_COST}`);
      expect(prefixed).toBeDefined();
      await reader.shutdown();
    });
  });

  describe('recording costs', () => {
    let meterProvider: MeterProvider;
    let exporter: InMemoryMetricExporter;
    let reader: PeriodicExportingMetricReader;
    let builder: MetricsBuilder;

    beforeEach(async () => {
      meterProvider = new MeterProvider();
      exporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
      reader = new PeriodicExportingMetricReader({
        exporter,
        exportIntervalMillis: 100,
      });
      meterProvider.addMetricReader(reader);
      const meter = meterProvider.getMeter('test');
      builder = createMetricsBuilder(meter);
    });

    afterEach(async () => {
      try {
        await reader.shutdown();
      } catch {
        // ignore
      }
    });

    it('should record costs on all three counters', async () => {
      const result = makeResult({ inputCostUsd: 30.0, outputCostUsd: 30.0, totalCostUsd: 60.0 });

      builder.recordCost(result);

      await reader.forceFlush();

      const metrics = exporter.getMetrics();
      const firstMetrics = metrics[0];
      if (!firstMetrics) throw new Error('expected metrics');
      const inputMetric = findMetric(firstMetrics, METRIC_INPUT_COST);
      const outputMetric = findMetric(firstMetrics, METRIC_OUTPUT_COST);
      const totalMetric = findMetric(firstMetrics, METRIC_TOTAL_COST);

      expect(inputMetric).toBeDefined();
      expect(outputMetric).toBeDefined();
      expect(totalMetric).toBeDefined();
    });

    it('should set model and provider as attributes', async () => {
      const result = makeResult({
        model: 'claude-3-opus',
        provider: 'anthropic',
        inputCostUsd: 15.0,
        outputCostUsd: 75.0,
        totalCostUsd: 90.0,
      });

      builder.recordCost(result);
      await reader.forceFlush();

      const metrics = exporter.getMetrics();
      const firstMetrics = metrics[0];
      if (!firstMetrics) throw new Error('expected metrics');
      const totalMetric = findMetric(firstMetrics, METRIC_TOTAL_COST);

      expect(totalMetric).toBeDefined();
      const dataPoints = (totalMetric as { dataPoints?: unknown })?.dataPoints;
      if (dataPoints && Array.isArray(dataPoints) && dataPoints.length > 0) {
        const point = dataPoints[0] as { attributes: Record<string, string> };
        expect(point.attributes.model).toBe('claude-3-opus');
        expect(point.attributes.provider).toBe('anthropic');
      }
    });

    it('should include custom labels in attributes', async () => {
      const result = makeResult({ inputCostUsd: 1.0, outputCostUsd: 2.0, totalCostUsd: 3.0 });

      builder.recordCost(result, { environment: 'production', feature: 'chat' });
      await reader.forceFlush();

      const metrics = exporter.getMetrics();
      const firstMetrics = metrics[0];
      if (!firstMetrics) throw new Error('expected metrics');
      const totalMetric = findMetric(firstMetrics, METRIC_TOTAL_COST);

      expect(totalMetric).toBeDefined();
      const dataPoints = (totalMetric as { dataPoints?: unknown })?.dataPoints;
      if (dataPoints && Array.isArray(dataPoints) && dataPoints.length > 0) {
        const point = dataPoints[0] as { attributes: Record<string, string> };
        expect(point.attributes.environment).toBe('production');
        expect(point.attributes.feature).toBe('chat');
      }
    });

    it('should record without custom labels (only model and provider)', async () => {
      const result = makeResult({ inputCostUsd: 5.0, outputCostUsd: 10.0, totalCostUsd: 15.0 });

      builder.recordCost(result);
      await reader.forceFlush();

      const metrics = exporter.getMetrics();
      const firstMetrics = metrics[0];
      if (!firstMetrics) throw new Error('expected metrics');
      const totalMetric = findMetric(firstMetrics, METRIC_TOTAL_COST);

      expect(totalMetric).toBeDefined();
      const dataPoints = (totalMetric as { dataPoints?: unknown })?.dataPoints;
      if (dataPoints && Array.isArray(dataPoints) && dataPoints.length > 0) {
        const point = dataPoints[0] as { attributes: Record<string, string> };
        expect(point.attributes.model).toBeDefined();
        expect(point.attributes.provider).toBeDefined();
        expect(Object.keys(point.attributes).length).toBe(2);
      }
    });
  });
});
