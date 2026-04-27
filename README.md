# otel-cost-exporter

<p align="center">
  <strong>OpenTelemetry-native cost metrics for every LLM call. Ship the pricing, not the headache.</strong>
</p>

<p align="center">
  <a href="https://github.com/reaatech/otel-cost-exporter/actions"><img alt="Build Status" src="https://img.shields.io/github/actions/workflow/status/reaatech/otel-cost-exporter/ci.yaml?branch=main"></a>
  <a href="https://www.npmjs.com/package/otel-cost-exporter"><img alt="npm version" src="https://img.shields.io/npm/v/otel-cost-exporter"></a>
  <a href="https://github.com/reaatech/otel-cost-exporter/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/npm/l/otel-cost-exporter"></a>
  <a href="https://nodejs.org"><img alt="Node.js" src="https://img.shields.io/node/v/otel-cost-exporter"></a>
</p>

---

## Problem

Every team running LLMs in production wants cost dashboards. Every team discovers that maintaining pricing tables for 10+ models across 5+ providers is a full-time job. Most teams hack together a spreadsheet, a cron job, and hope for the best.

**otel-cost-exporter** replaces all of that with an OTel-native component. It watches your GenAI semantic convention spans, looks up current pricing from bundled tables (updated on semver patches), and emits `llm.cost.*` metrics — all with zero content access and zero pricing maintenance from your team.

## Features

- **Zero-config pricing** — Bundled tables for OpenAI, Anthropic, Google, AWS Bedrock, and Azure. Updates ship as patch releases.
- **OTel-native** — Reads GenAI semantic convention spans. Emits standard OTel metrics. Fits into any existing OTel pipeline.
- **Two deployment modes** — Runs as a Collector processor or as an in-process exporter for Node.js apps.
- **Granular metrics** — `llm.cost.input_tokens_usd`, `llm.cost.output_tokens_usd`, `llm.cost.total_usd` with labels for model, provider, service, and custom dimensions.
- **Per-1M token normalization** — All prices stored internally at the same scale. No more per-1K vs per-1M confusion.
- **Configurable defaults** — Set fallback pricing for unknown models. Override any provider's pricing via config or env vars.
- **Privacy-first** — Processes only metadata (model name, token counts). Never touches LLM content or prompts.

## Quick Start

### Install

```bash
# npm
npm install otel-cost-exporter

# pnpm (recommended)
pnpm add otel-cost-exporter
```

### In-Process Exporter (Node.js SDK)

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  loadConfig,
  createProcessorFactory,
  createCostSpanProcessor,
  createMetricsBuilder,
  createPrometheusExporter,
} from 'otel-cost-exporter';

const config = await loadConfig('./otel-cost-exporter.yaml');

const factory = createProcessorFactory(config);
const spanProcessor = await factory.createProcessor();

const costSpanProcessor = createCostSpanProcessor({
  costProcessor: spanProcessor,
});

const metrics = createMetricsBuilder(meter, config.metrics.prefix);
const prometheus = createPrometheusExporter({ port: 9464 });

const sdk = new NodeSDK({
  metricReader: prometheus,
  spanProcessors: [costSpanProcessor],
  // ... your other OTel config
});

sdk.start();
```

### Collector Processor (Standalone Service)

```bash
# Start the cost exporter as a standalone OTLP pipeline
npx otel-cost-exporter serve --port 4317 --metrics-port 8888
```

The serve command accepts OTLP JSON traces on the specified port and exposes cost metrics via Prometheus on the metrics port.

### Emitted Metrics

```
llm.cost.input_tokens_usd{model="gpt-4",provider="openai",service="chat-api"} 0.0300
llm.cost.output_tokens_usd{model="gpt-4",provider="openai",service="chat-api"} 0.0600
llm.cost.total_usd{model="gpt-4",provider="openai",service="chat-api"} 0.0900
```

Prometheus-compatible exporters automatically transform dots to underscores in metric names.

## Supported Providers

| Provider | Models | Pricing Source |
|----------|--------|---------------|
| **OpenAI** | GPT-4, GPT-4 Turbo, GPT-4o, GPT-3.5 Turbo | [Official API pricing](https://openai.com/api/pricing/) |
| **Anthropic** | Claude 3 Opus, Sonnet, Haiku | [Anthropic docs](https://www.anthropic.com/pricing) |
| **Google** | Gemini Pro, Gemini Ultra, Gemini Flash | [Vertex AI pricing](https://cloud.google.com/vertex-ai/pricing) |
| **AWS Bedrock** | Claude, Llama, Titan models | [AWS pricing API](https://aws.amazon.com/bedrock/pricing/) |
| **Azure OpenAI** | GPT-4, GPT-35 Turbo | [Azure pricing](https://azure.microsoft.com/pricing/) |

All prices are normalized to **USD per 1,000,000 tokens**.

## Configuration

```yaml
# otel-cost-exporter.yaml
pricing:
  # Path to custom pricing overrides
  customTablePath: /etc/otel/pricing.yaml

  # Auto-update pricing tables
  autoUpdate: true

  # Check interval for updates
  updateInterval: 24h

  # Fallback price for unknown models ($ per 1M tokens)
  defaultPrice: 2.0

metrics:
  # Metric name prefix
  prefix: llm_cost

  # Labels added to every metric
  labels:
    environment: production
    team: platform
    region: us-east-1

export:
  # prometheus | otlp | json
  format: prometheus

  # Push interval (for pull-based)
  interval: 60s

  # Export endpoint
  endpoint: http://localhost:9090

logging:
  level: info
  format: json
```

### Environment Variables

All config fields map to environment variables:

| Config Path | Env Variable |
|------------|--------------|
| `pricing.custom_table_path` | `OTEL_COST_PRICING_CUSTOM_TABLE_PATH` |
| `pricing.auto_update` | `OTEL_COST_PRICING_AUTO_UPDATE` |
| `pricing.default_price` | `OTEL_COST_PRICING_DEFAULT_PRICE` |
| `metrics.prefix` | `OTEL_COST_METRICS_PREFIX` |
| `export.format` | `OTEL_COST_EXPORT_FORMAT` |

## Architecture

```
Application → GenAI Span → Span Processor → Model Normalizer
                                              │
                                    ┌─────────▼─────────┐
                                    │  Pricing Service   │
                                    │  (bundled tables   │
                                    │   + overrides)     │
                                    └─────────┬─────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │  Cost Calculator   │
                                    │  (cache-backed)    │
                                    └─────────┬─────────┘
                                              │
                                    ┌─────────▼─────────┐
                                    │  Metrics Exporter  │
                                    │  Prometheus|OTLP   │
                                    │  |JSON/debug       │
                                    └───────────────────┘
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for full architectural documentation including data flow, concurrency model, deployment patterns, and extension points.

## Development

```bash
# Prerequisites: Node.js 22+, pnpm 9

# Enable pnpm
corepack enable && corepack prepare pnpm@9 --activate

# Install
pnpm install --frozen-lockfile

# Build
pnpm build

# Test
pnpm test
pnpm test:coverage       # with coverage (>85% required)

# Lint & Format
pnpm lint
pnpm format

# Type check
pnpm typecheck            # tsc --noEmit

# Pre-commit (runs all checks)
pnpm pre-commit
```

Coverage thresholds are enforced at **>85%** across all components. See `vitest.config.ts` for configured watermarks.

## Documentation

| Document | Audience |
|----------|----------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, data flow, deployment |
| [DEV_PLAN.md](DEV_PLAN.md) | Development phases and roadmap |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |
| [AGENTS.md](AGENTS.md) | AI agent development guidelines |
| [CHANGELOG.md](CHANGELOG.md) | Release history |

### Skills

Agent skills for common maintenance tasks:

- [Pricing table updates](skills/pricing-update.md)
- [Adding new models/providers](skills/model-addition.md)
- [Troubleshooting](skills/troubleshooting.md)
- [Release procedures](skills/release-procedure.md)
- [Security review](skills/security-review.md)
- [npm/pnpm workflows](skills/npm-workflow.md)
- [Code review](skills/code-review.md)
- [Documentation maintenance](skills/docs-maintenance.md)

## License

MIT — see [LICENSE](LICENSE)

---

<p align="center">
  Built by <a href="https://reaatech.com">Reaatech</a>
</p>
