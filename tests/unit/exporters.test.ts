import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { createPrometheusExporter } from '../../src/exporter/prometheus.js';
import { createOtlpExporter } from '../../src/exporter/otlp.js';
import { createJsonExporter } from '../../src/exporter/json.js';
import type { CostBreakdown } from '../../src/types/domain.js';

describe('Prometheus exporter', () => {
  describe('creation', () => {
    it('should create a Prometheus exporter with defaults', () => {
      const exporter = createPrometheusExporter();
      expect(exporter).toBeDefined();
      expect(exporter.export).toBeInstanceOf(Function);
      expect(exporter.shutdown).toBeInstanceOf(Function);
    });

    it('should create a Prometheus exporter with custom port', async () => {
      const exporter = createPrometheusExporter({ port: 9999 });
      expect(exporter).toBeDefined();
      await exporter.shutdown();
    });

    it('should create a Prometheus exporter with custom endpoint', async () => {
      const exporter = createPrometheusExporter({ endpoint: '/monitoring' });
      expect(exporter).toBeDefined();
      await exporter.shutdown();
    });

    it('should create a Prometheus exporter with custom port and endpoint', async () => {
      const exporter = createPrometheusExporter({ port: 9091, endpoint: '/custom-metrics' });
      expect(exporter).toBeDefined();
      await exporter.shutdown();
    });
  });

  describe('export', () => {
    it('should be a no-op for pull-based exporter', async () => {
      const exporter = createPrometheusExporter();
      const promise = exporter.export([]);
      await expect(promise).resolves.toBeUndefined();
      await exporter.shutdown();
    });

    it('should export with empty metrics array', async () => {
      const exporter = createPrometheusExporter();
      await exporter.export([]);
      await exporter.export([
        {
          inputCostUsd: 1.0,
          outputCostUsd: 2.0,
        },
      ]);
      await exporter.shutdown();
    });
  });

  describe('shutdown', () => {
    it('should shut down the underlying exporter', async () => {
      const exporter = createPrometheusExporter();
      const promise = exporter.shutdown();
      await expect(promise).resolves.toBeUndefined();
    });

    it('should allow multiple shutdown calls', async () => {
      const exporter = createPrometheusExporter({ port: 8887 });
      await exporter.shutdown();
      await exporter.shutdown();
      await expect(exporter.shutdown()).resolves.toBeUndefined();
    });
  });
});

describe('OTLP exporter', () => {
  describe('creation', () => {
    it('should create an OTLP exporter with defaults', () => {
      const exporter = createOtlpExporter();
      expect(exporter).toBeDefined();
      expect(exporter.export).toBeInstanceOf(Function);
      expect(exporter.shutdown).toBeInstanceOf(Function);
    });

    it('should create an OTLP exporter with custom endpoint', async () => {
      const exporter = createOtlpExporter({ endpoint: 'http://localhost:5000/v1/metrics' });
      expect(exporter).toBeDefined();
      await exporter.shutdown();
    });
  });

  describe('export', () => {
    it('should trigger a flush without error', async () => {
      const exporter = createOtlpExporter();
      // Export should not throw even if no MeterProvider is configured
      await expect(exporter.export([])).resolves.toBeUndefined();
      await exporter.shutdown();
    });
  });

  describe('shutdown', () => {
    it('should shut down the reader', async () => {
      const exporter = createOtlpExporter();
      await exporter.shutdown();
      await expect(exporter.shutdown()).resolves.toBeUndefined();
    });
  });
});

describe('JSON exporter', () => {
  describe('creation', () => {
    it('should create a JSON exporter', () => {
      const exporter = createJsonExporter();
      expect(exporter).toBeDefined();
      expect(exporter.export).toBeInstanceOf(Function);
      expect(exporter.shutdown).toBeInstanceOf(Function);
    });
  });

  describe('export', () => {
    let stdoutSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      stdoutSpy = vi.fn(() => true);
      vi.spyOn(process.stdout, 'write').mockImplementation(stdoutSpy as any);
    });

    afterEach(() => {
      stdoutSpy.mockRestore();
    });

    it('should write each cost as a JSON line to stdout', async () => {
      const exporter = createJsonExporter();

      const costs: CostBreakdown[] = [
        { inputCostUsd: 30.0, outputCostUsd: 30.0 },
        {
          inputCostUsd: 15.0,
          outputCostUsd: 75.0,
          cacheReadCostUsd: 0.3,
          cacheCreationCostUsd: 1.875,
        },
      ];

      await exporter.export(costs);

      expect(stdoutSpy).toHaveBeenCalledTimes(2);

      const firstCall = stdoutSpy.mock.calls[0]![0] as string;
      expect(firstCall).toContain('"inputCostUsd":30');
      expect(firstCall).toContain('"outputCostUsd":30');
      expect(firstCall).toMatch(/\n$/);

      const secondCall = stdoutSpy.mock.calls[1]![0] as string;
      expect(secondCall).toContain('"cacheReadCostUsd":0.3');
      expect(secondCall).toContain('"cacheCreationCostUsd":1.875');
      expect(secondCall).toMatch(/\n$/);
    });

    it('should handle an empty array', async () => {
      const exporter = createJsonExporter();
      await exporter.export([]);
      expect(stdoutSpy).not.toHaveBeenCalled();
    });

    it('should handle a single cost entry', async () => {
      const exporter = createJsonExporter();

      await exporter.export([{ inputCostUsd: 1.5, outputCostUsd: 3.0 }]);

      expect(stdoutSpy).toHaveBeenCalledTimes(1);
      const call = stdoutSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(call.trim());
      expect(parsed.inputCostUsd).toBe(1.5);
      expect(parsed.outputCostUsd).toBe(3.0);
    });
  });

  describe('shutdown', () => {
    it('should be a no-op', async () => {
      const exporter = createJsonExporter();
      await expect(exporter.shutdown()).resolves.toBeUndefined();
    });

    it('should not throw on multiple calls', async () => {
      const exporter = createJsonExporter();
      await exporter.shutdown();
      await exporter.shutdown();
      await expect(exporter.shutdown()).resolves.toBeUndefined();
    });
  });
});
