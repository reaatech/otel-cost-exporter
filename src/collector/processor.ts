import type { Config } from '@/config/config.js';
import type { SpanProcessor } from '@/processor/processor.js';
import type { MetricsBuilder } from '@/metrics/builder.js';

import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(
  await readFile(new URL('../../package.json', import.meta.url), 'utf-8'),
) as { version: string };

import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
  type MetricReader,
} from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import { createCostSpanProcessor } from '@/otel/cost-processor.js';
import { createProcessorFactory } from '@/processor/factory.js';
import { createMetricsBuilder } from '@/metrics/builder.js';
import { createLogger } from '@/utils/logger.js';
import { parseIntervalMs } from '@/utils/interval.js';
import { createHealthServer } from '@/collector/server.js';
import type { HealthServer } from '@/collector/server.js';

const SERVICE_VERSION = pkg.version;

export interface CollectorService {
  start(): Promise<void>;
  shutdown(): Promise<void>;
}

export async function createCollectorService(config: Config): Promise<CollectorService> {
  const logger = createLogger(config.logging.level, config.logging.format);

  logger.info('Initializing collector service pipeline');

  const factory = createProcessorFactory(config);
  const spanProcessor: SpanProcessor = await factory.createProcessor();

  logger.info('Pricing tables loaded, span processor created');

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: 'otel-cost-exporter',
    [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
    ...config.metrics.labels,
  });

  const meterProvider = new MeterProvider({ resource });

  if (config.export.format === 'prometheus') {
    const prometheusReader = new PrometheusExporter({
      port: 8888,
      endpoint: '/metrics',
    });
    meterProvider.addMetricReader(prometheusReader as unknown as MetricReader);
    logger.info({ port: 8888, endpoint: '/metrics' }, 'Prometheus metrics endpoint started');
  } else if (config.export.format === 'otlp') {
    const otlpExporter = new OTLPMetricExporter({
      url: config.export.endpoint ?? 'http://localhost:4318/v1/metrics',
    });
    const reader = new PeriodicExportingMetricReader({
      exporter: otlpExporter,
      exportIntervalMillis: config.export.interval
        ? parseIntervalMs(config.export.interval)
        : 60_000,
    });
    meterProvider.addMetricReader(reader);
    logger.info(
      {
        endpoint: config.export.endpoint ?? 'http://localhost:4318/v1/metrics',
      },
      'OTLP metrics export configured',
    );
  } else if (config.export.format === 'json') {
    const consoleExporter = new ConsoleMetricExporter();
    const reader = new PeriodicExportingMetricReader({
      exporter: consoleExporter,
      exportIntervalMillis: config.export.interval
        ? parseIntervalMs(config.export.interval)
        : 60_000,
    });
    meterProvider.addMetricReader(reader);
    logger.info({ format: 'json' }, 'Console metric export configured');
  }

  const meter = meterProvider.getMeter('otel-cost-exporter');

  const metricsBuilder: MetricsBuilder = createMetricsBuilder(meter, config.metrics.prefix);

  const healthPort = config.export.healthPort ?? 8889;
  const healthServer: HealthServer = createHealthServer();

  let spansProcessedCount = 0;

  function recordSpan(): void {
    spansProcessedCount++;
    healthServer.updateDebugInfo({
      uptime: 0,
      spansProcessed: spansProcessedCount,
      spansDropped: 0,
    });
  }

  const otelSpanProcessor = createCostSpanProcessor({
    costProcessor: spanProcessor,
    logger,
    metricsBuilder,
    onSpanRecorded: recordSpan,
  });

  /* @opentelemetry/sdk-node resolves sdk-trace-base at a different version
     than the top-level dep, producing incompatible SpanProcessor types.
     The `as any` cast bridges this version mismatch. */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const sdk = new NodeSDK({
    resource,
    spanProcessors: [otelSpanProcessor as any],
    instrumentations: [],
  });
  /* eslint-enable @typescript-eslint/no-explicit-any */

  return {
    async start(): Promise<void> {
      await sdk.start();
      await healthServer.start(healthPort);
      healthServer.updateDebugInfo({
        pricingTableVersion: '0.1.0',
        modelCount: 0,
        uptime: 0,
        spansProcessed: 0,
        spansDropped: 0,
      });
      logger.info(
        {
          format: config.export.format,
          prefix: config.metrics.prefix,
          healthPort,
        },
        'Collector service started — OTLP trace receiver active on ports 4317 (gRPC) and 4318 (HTTP), health on 8889',
      );
    },

    async shutdown(): Promise<void> {
      logger.info('Shutting down collector service');
      await healthServer.shutdown();
      await sdk.shutdown();
      await spanProcessor.shutdown();
      await meterProvider.shutdown();
      logger.info('Collector service shut down');
    },
  };
}
