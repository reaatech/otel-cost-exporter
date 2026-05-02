import { readFileSync } from 'node:fs';
import http from 'node:http';

import { SpanStatusCode } from '@opentelemetry/api';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import type { MetricReader } from '@opentelemetry/sdk-metrics';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import { createLogger } from '@reaatech/otel-cost-exporter-core';
import type { CostSpan } from '@reaatech/otel-cost-exporter-core';

import {
  createMetricsBuilder,
  createProcessorFactory,
  loadConfig,
} from '@reaatech/otel-cost-exporter';
import type { Config, MetricsBuilder, SpanProcessor } from '@reaatech/otel-cost-exporter';

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

const SERVICE_VERSION = pkg.version;

interface RawOtlpAttribute {
  key: string;
  value: {
    stringValue?: string;
    intValue?: string;
    doubleValue?: number;
  };
}

interface RawOtlpSpan {
  traceId: string;
  spanId: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: RawOtlpAttribute[];
  status?: { code: number; message?: string };
}

interface RawOtlpScopeSpan {
  spans: RawOtlpSpan[];
}

interface RawOtlpResourceSpan {
  resourceSpans?: RawOtlpResourceSpan[];
  scopeSpans: RawOtlpScopeSpan[];
}

function getAttr(spans: RawOtlpSpan[], key: string): string | undefined {
  for (const span of spans) {
    const attr = span.attributes.find((a) => a.key === key);
    if (attr) {
      return attr.value.stringValue ?? attr.value.intValue;
    }
  }
  return undefined;
}

function getAttrNum(spans: RawOtlpSpan[], key: string): number {
  const val = getAttr(spans, key);
  if (val === undefined) return 0;
  const num = Number.parseInt(val, 10);
  return Number.isNaN(num) ? 0 : num;
}

function parseOtlpJson(body: string): CostSpan[] {
  const data: unknown = JSON.parse(body);
  const root = data as RawOtlpResourceSpan;

  const resourceSpans: RawOtlpResourceSpan[] =
    root.resourceSpans ?? (root.scopeSpans ? [root] : []);

  const costSpans: CostSpan[] = [];

  for (const resource of resourceSpans) {
    for (const scope of resource.scopeSpans ?? []) {
      for (const span of scope.spans ?? []) {
        const provider = getAttr([span], 'gen_ai.system') ?? 'unknown';
        const model = getAttr([span], 'gen_ai.request.model') ?? 'unknown';
        const inputTokens = getAttrNum([span], 'gen_ai.usage.input_tokens');
        const outputTokens = getAttrNum([span], 'gen_ai.usage.output_tokens');

        const startTimeNs = BigInt(span.startTimeUnixNano);
        const endTimeNs = BigInt(span.endTimeUnixNano);
        const durationNs = endTimeNs - startTimeNs;
        const durationMs = Number(durationNs / BigInt(1_000_000));

        const isError = span.status?.code === SpanStatusCode.ERROR;

        costSpans.push({
          spanId: span.spanId,
          traceId: span.traceId,
          provider,
          model,
          inputTokens,
          outputTokens,
          costUsd: 0,
          costBreakdown: {
            inputCostUsd: 0,
            outputCostUsd: 0,
          },
          telemetry: {},
          timestamp: new Date(),
          startTime: new Date(Number(startTimeNs / BigInt(1_000_000))),
          endTime: new Date(Number(endTimeNs / BigInt(1_000_000))),
          durationMs,
          status: isError ? 'error' : 'success',
          errorMessage: isError ? span.status?.message : undefined,
        });
      }
    }
  }

  return costSpans;
}

export interface ServeCommandOptions {
  config?: string;
  port: number;
  metricsPort: number;
}

export async function serveCommand(options: ServeCommandOptions): Promise<void> {
  const config: Config = await loadConfig(options.config);
  const logger = createLogger(config.logging.level, config.logging.format);

  logger.info({ config: options }, 'Starting otel-cost-exporter serve');

  const factory = createProcessorFactory(config);
  const processor: SpanProcessor = await factory.createProcessor();

  logger.info('Pricing tables loaded, span processor created');

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: 'otel-cost-exporter',
    [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
    ...config.metrics.labels,
  });

  const prometheusExporter = new PrometheusExporter({
    port: options.metricsPort,
    endpoint: '/metrics',
  });

  const meterProvider = new MeterProvider({
    resource,
    readers: [prometheusExporter as unknown as MetricReader],
  });

  const meter = meterProvider.getMeter('otel-cost-exporter');
  const metricsBuilder: MetricsBuilder = createMetricsBuilder(meter, config.metrics.prefix);

  logger.info(
    { port: options.metricsPort, endpoint: '/metrics' },
    'Prometheus metrics endpoint configured',
  );

  const server = http.createServer(async (req, res) => {
    if (req.url === '/v1/traces' && req.method === 'POST') {
      if (!req.headers['content-type']?.startsWith('application/json')) {
        res.writeHead(415).end(JSON.stringify({ error: 'Unsupported content type' }));
        return;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      const body = Buffer.concat(chunks).toString('utf-8');

      try {
        const spans = parseOtlpJson(body);
        if (spans.length > 0) {
          const results = await processor.processSpans(spans);
          for (const result of results) {
            if (!result.error) {
              metricsBuilder.recordCost(result.cost, config.metrics.labels);
            }
          }
        }
        res.writeHead(200).end(JSON.stringify({ partialSuccess: {} }));
      } catch (err) {
        logger.warn({ err }, 'Failed to parse OTLP payload');
        res.writeHead(400).end(JSON.stringify({ error: 'Invalid OTLP payload' }));
      }
      return;
    }

    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200).end('OK');
      return;
    }

    res.writeHead(404).end('Not Found');
  });

  server.keepAliveTimeout = 120_000;
  server.headersTimeout = 125_000;

  const serverPromise = new Promise<void>((resolve, reject) => {
    server.listen(options.port, () => {
      logger.info(`Listening on port ${options.port}, metrics on port ${options.metricsPort}`);
      resolve();
    });
    server.on('error', reject);
  });

  let shuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');

    await processor.shutdown();
    await meterProvider.shutdown();

    server.close(() => {
      logger.info('Server closed');
    });

    process.exit(0);
  }

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  await serverPromise;
}
