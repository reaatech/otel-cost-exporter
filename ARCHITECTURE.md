# Architecture: otel-cost-exporter

## System Overview

The otel-cost-exporter is designed as a modular, extensible system that integrates seamlessly with the OpenTelemetry ecosystem. It operates as either an OpenTelemetry Collector processor or an in-process exporter, processing GenAI semantic convention spans to calculate and emit cost metrics.

## Design Principles

1. **OTel-Native**: Built as a first-class OpenTelemetry citizen, following all OTel specifications and conventions
2. **Zero-Content Policy**: Never logs or processes LLM content, only metadata (model names, token counts)
3. **Pluggable Pricing**: Pricing tables are externalized and updatable without code changes
4. **Performance-First**: Optimized for high-throughput span processing with minimal overhead
5. **Observability Built-In**: Comprehensive internal metrics and structured logging

## Component Architecture

### Entry Points — Shared Kernel

The core logic is shared between both deployment modes. Only the lifecycle management and host integration differ.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Shared Kernel                                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐   │
│  │ Span         │ │ Model        │ │ Cost         │ │ Metrics          │   │
│  │ Processor    │ │ Normalizer   │ │ Calculator   │ │ Builder          │   │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └────────┬─────────┘   │
│         └────────────────┼────────────────┼──────────────────┘             │
│                          ▼                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Pricing Service (shared)                            │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                          │                                                  │
│                          ▼                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    Export Layer (shared)                               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└───────────────┬──────────────────────────────────────┬──────────────────────┘
                │                                      │
    ┌───────────▼───────────────┐        ┌─────────────▼─────────────┐
    │  Collector Processor      │        │   In-Process Exporter     │
    │                           │        │                           │
    │  - components.Host lifecycle│      │  - SDK integration         │
    │  - Factory pattern         │        │  - Direct export           │
    │  - Config from OTel conf   │        │  - Programmatic config     │
    │  - Lifecycle mgmt          │        │  - Importable TypeScript library   │
    └───────────────────────────┘        └───────────────────────────┘
```

Below are the detailed data flow stages shared by both entry points:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Entry Points                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐          ┌──────────────────────┐                │
│  │  Collector Processor │          │   In-Process Exporter│                │
│  │                      │          │                      │                │
│  │  - Factory pattern   │          │  - SDK integration   │                │
│  │  - Lifecycle mgmt    │          │  - Direct export     │                │
│  │  - Config from OTel  │          │  - Programmatic cfg  │                │
│  └──────────────────────┘          └──────────────────────┘                │
│              │                                  │                           │
│              └──────────────────┬───────────────┘                           │
│                                 │                                           │
│                                 ▼                                           │
│                    ┌─────────────────────┐                                  │
│                    │   Span Processor    │                                  │
│                    │                     │                                  │
│                    │  - Attribute extract│                                  │
│                    │  - Validation       │                                  │
│                    │  - Batch processing │                                  │
│                    └─────────────────────┘                                  │
│                                 │                                           │
│                                 ▼                                           │
│                    ┌─────────────────────┐                                  │
│                    │  Model Normalizer   │                                  │
│                    │                     │                                  │
│                    │  - Name resolution  │                                  │
│                    │  - Provider detect  │                                  │
│                    │  - Alias mapping    │                                  │
│                    └─────────────────────┘                                  │
│                                 │                                           │
│                                 ▼                                           │
│                    ┌─────────────────────┐                                  │
│                    │  Cost Calculator    │                                  │
│                    │                     │                                  │
│                    │  - Pricing lookup   │                                  │
│                    │  - Cost computation │                                  │
│                    │  - Cache management │                                  │
│                    └─────────────────────┘                                  │
│                                 │                                           │
│                                 ▼                                           │
│                    ┌─────────────────────┐                                  │
│                    │   Metrics Builder   │                                  │
│                    │                     │                                  │
│                    │  - Label assembly   │                                  │
│                    │  - Metric creation  │                                  │
│                    │  - Aggregation      │                                  │
│                    └─────────────────────┘                                  │
│                                 │                                           │
│                                 ▼                                           │
│                    ┌─────────────────────────────────────┐                  │
│                    │         Export Layer                │                  │
│                    │                                     │                  │
│                    │  ┌──────────┐ ┌──────────┐ ┌──────┐│                  │
│                    │  │Prometheus│ │   OTLP   │ │ JSON ││                  │
│                    │  │ Exporter │ │ Exporter │ │Export││                  │
│                    │  └──────────┘ └──────────┘ └──────┘│                  │
│                    └─────────────────────────────────────┘                  │
│                                 │                                           │
│                                 ▼                                           │
│                    ┌─────────────────────┐                                  │
│                    │   Pricing Service   │                                  │
│                    │                     │                                  │
│                    │  - Table management │                                  │
│                    │  - Update handling  │                                  │
│                    │  - Validation       │                                  │
│                    └─────────────────────┘                                  │
│                                 │                                           │
│                                 ▼                                           │
│                    ┌─────────────────────┐                                  │
│                    │   Pricing Tables    │                                  │
│                    │                     │                                  │
│                    │  - Bundled tables   │                                  │
│                    │  - Custom overrides │                                  │
│                    │  - Version tracking │                                  │
│                    └─────────────────────┘                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Span Ingestion

```
GenAI Span → Attribute Extraction → Validation → Normalization
```

The span processor receives OpenTelemetry spans and extracts relevant attributes:

- `gen_ai.system` - Provider identifier (e.g., `openai`, `anthropic`) — primary provider signal
- `gen_ai.request.model` - Model identifier
- `gen_ai.usage.input_tokens` - Input token count
- `gen_ai.usage.output_tokens` - Output token count
- `service.name` - Service identifier
- Custom attributes for additional labels

### 2. Model Resolution

```
gen_ai.system + gen_ai.request.model → Provider Detection → Alias Resolution → Pricing Key
```

The model normalizer:

1. Uses `gen_ai.system` as the primary provider signal (falls back to model name pattern matching if absent)
2. Resolves aliases (e.g., "gpt4" → "gpt-4")
3. Generates pricing lookup key
4. Handles unknown models gracefully

### 3. Cost Calculation

```
Pricing Key + Token Counts → Table Lookup → Cost Computation → Cache
```

The cost calculator:

1. Checks cache for pricing information
2. Falls back to pricing table lookup
3. Computes input and output costs
4. Updates cache with TTL
5. Handles missing pricing with configurable defaults

### 4. Metrics Generation

```
Cost Data + Labels → Metric Assembly → Aggregation → Export
```

The metrics builder:

1. Assembles standard labels (model, provider, service)
2. Adds custom labels from configuration
3. Creates metric data points
4. Optionally aggregates by time window
5. Prepares for export format

### 5. Export

```
Metrics → Format Conversion → Transport → Destination
```

Export formats supported:

- **Prometheus**: Text format for pull-based scraping
- **OTLP**: Binary format for push to OTel backends
- **JSON**: Human-readable format for debugging

## Pricing Table Architecture

### Table Structure

All prices are stored internally as USD per 1,000,000 tokens. Conversion from provider-native units (per-1K, per-1M) happens at table load time.

```yaml
version: "2024.01"
last_updated: "2024-01-15T00:00:00Z"
pricing_unit: 1000000  # all prices per 1M tokens

providers:
  openai:
    models:
      gpt-4:
        input_token_price: 30.0    # $30 per 1M input tokens
        output_token_price: 60.0   # $60 per 1M output tokens
        effective_date: "2024-01-01"
      gpt-4-turbo:
        input_token_price: 10.0
        output_token_price: 30.0
        effective_date: "2024-01-01"
  
  anthropic:
    models:
      claude-3-opus:
        input_token_price: 15.0
        output_token_price: 75.0
      claude-3-sonnet:
        input_token_price: 3.0
        output_token_price: 15.0
```

### Pricing Update Flow

```
Scheduled Check → Fetch from pricing source → Version Compare → Download → Validate → Apply
```

1. **Scheduled Check**: Periodic check for new pricing versions
2. **Fetch**: Download pricing table from configured source (GitHub releases, S3 bucket, or custom URL)
3. **Version Compare**: Compare local vs remote version
4. **Download**: Fetch new pricing table if available
5. **Validate**: Verify table format and signatures
6. **Apply**: Hot-reload pricing table via atomic pointer swap (no restart required)

The default pricing source is `https://github.com/reaatech/otel-cost-exporter/releases/latest/download/pricing-tables.tar.gz`. Custom sources can be configured via `pricing.update_url`.

### Pricing Override Mechanism

```
Custom Table → Merge with Bundled → Precedence Rules → Final Table
```

Custom pricing tables can:

- Override specific provider pricing
- Add new models not in bundled tables
- Set default pricing for unknown models
- Configure currency conversion rates

## Configuration System

### Configuration Hierarchy

```
Defaults → File Config → Environment Variables → CLI Flags
```

Each level overrides the previous:

1. **Defaults**: Built-in sensible defaults
2. **File Config**: YAML configuration file
3. **Environment Variables**: `OTEL_COST_*` prefixed
4. **CLI Flags**: Command-line arguments

### Configuration Schema

```typescript
interface Config {
  pricing: PricingConfig;
  metrics: MetricsConfig;
  export: ExportConfig;
  logging: LoggingConfig;
  processor: ProcessorConfig;
}

interface PricingConfig {
  /** Path to custom pricing table YAML */
  customTablePath?: string;          // env: OTEL_COST_PRICING_CUSTOM_TABLE_PATH
  /** Enable automatic pricing updates */
  autoUpdate: boolean;               // env: OTEL_COST_PRICING_AUTO_UPDATE
  /** Update check interval */
  updateInterval: string;            // env: OTEL_COST_PRICING_UPDATE_INTERVAL
  /** Remote pricing table URL */
  updateURL?: string;                // env: OTEL_COST_PRICING_UPDATE_URL
  /** Fallback price for unknown models (USD per 1M tokens) */
  defaultPrice?: number;             // env: OTEL_COST_PRICING_DEFAULT_PRICE
}

interface MetricsConfig {
  /** Metric name prefix */
  prefix: string;                    // env: OTEL_COST_METRICS_PREFIX
  /** Additional labels added to all metrics */
  labels: Record<string, string>;    // env: OTEL_COST_METRICS_LABELS (JSON)
}

interface ExportConfig {
  /** Export format: prometheus, otlp, json */
  format: 'prometheus' | 'otlp' | 'json';  // env: OTEL_COST_EXPORT_FORMAT
  /** Push interval for pull-based exports */
  interval?: string;                  // env: OTEL_COST_EXPORT_INTERVAL
  /** Export endpoint URL */
  endpoint?: string;                  // env: OTEL_COST_EXPORT_ENDPOINT
}
```

## Performance Considerations

### Collector Processor Mode

The "collector processor" mode is implemented as a **standalone OTLP pipeline service** — not as a Go collector plugin. It runs as a Node.js process that receives spans via OTLP (gRPC/HTTP), processes them through the shared kernel, and exports cost metrics to Prometheus, OTLP backends, or JSON. This enables sidecar and gateway deployment patterns without requiring Go compilation.

### GenAI Semantic Convention Version

The GenAI semantic conventions are experimental in OpenTelemetry. This project:
- Pins to a specific semconv version (declared in `src/semconv/version.ts`)
- Uses an attribute mapping layer that decouples experimental attribute names from core logic
- Supports configuration-driven overrides: `gen_ai.request.model` → custom attribute name

### Concurrency Model

The processor is designed for concurrent span processing with minimal contention in Node.js:

| Component | Strategy | Rationale |
|-----------|----------|-----------|
| Span processing | Per-span: lock-free | Immutable span attributes, new metric allocation per span |
| Pricing cache | In-memory `Map` with LRU eviction | Read-heavy workload (reads per span, writes on miss) |
| Metrics aggregation | Per-instrument atomic writes via OTel SDK | The OTel SDK handles thread safety internally |
| Export | Single async export cycle with buffered fan-in | Serializes export to avoid concurrent backend writes |
| Pricing reload | Object reference swap | Object reference assignment is atomic in JavaScript |
| Configuration | Reference swap on reload | Read-heavy, only changes on reload |

```typescript
// Config service with atomic reference swap
class ConfigService {
  private config: Config;

  constructor(initial: Config) {
    this.config = initial;
  }

  getSnapshot(): Config {
    return this.config; // Object reference swap is atomic in JS
  }

  async reload(): Promise<void> {
    const next = await loadConfig();
    this.config = next;
  }
}
```

### Caching Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                     Cache Hierarchy                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  L1: In-Memory LRU Cache (active)                           │
│  ├── Provider:Model → Pricing lookup                        │
│  ├── LRU eviction with configurable max size (default 1000) │
│  └── Hit/miss tracking for observability                    │
│                                                              │
│  Future: L2 Per-Provider Bulk Cache (planned)               │
│  ├── Provider → All model prices                            │
│  └── Optimize for fan-out lookup patterns                   │
│                                                              │
│  Future: L3 Disk Cache (planned)                            │
│  ├── Serialized pricing tables for offline operation        │
│  └── Location: Configurable                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Batch Processing

- Spans processed in configurable batches (default: 100)
- Reduces per-span overhead
- Improves cache hit rate
- Configurable batch timeout

### Memory Optimization

- Streaming processing where possible
- Minimal allocations in hot path
- Efficient data structures
- Configurable memory limits

## Error Handling

### Error Categories


| Category            | Handling                       | Recovery                    |
| ------------------- | ------------------------------ | --------------------------- |
| Unknown Model       | Log warning, use default price | Manual pricing table update |
| Missing Tokens      | Estimate from context length   | Improve instrumentation     |
| Pricing Lookup Fail | Use cached value, then default | Retry with backoff          |
| Configuration Error | Fail fast on startup           | Fix configuration           |
| Export Failure      | Buffer metrics, retry          | Exponential backoff         |

### Graceful Degradation

1. If pricing table unavailable → Use cached prices
2. If cache miss → Use default price
3. If export fails → Buffer locally
4. If buffer full → Drop oldest metrics

## Security Model

### Data Privacy

- **No Content Processing**: Only metadata (model, tokens) processed
- **No PII Storage**: No personally identifiable information stored
- **Minimal Logging**: Structured logs without sensitive data

### Pricing Table Security

- **Signature Verification**: Tables signed with GPG keys
- **HTTPS Only**: All remote table fetches over HTTPS
- **Version Pinning**: Optional version pinning for stability

### Access Control

- **Read-Only Pricing**: Pricing tables are read-only after load
- **Configuration Validation**: All config values validated
- **Resource Limits**: Configurable memory and CPU limits

## Deployment Patterns

### Pattern 1: Sidecar in Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-with-cost-exporter
spec:
  template:
    spec:
      containers:
      - name: app
        image: my-app:latest
      - name: cost-exporter
        image: otel-cost-exporter:latest
        ports:
        - containerPort: 8888
          name: metrics
```

### Pattern 2: Collector Processor

```yaml
receivers:
  otlp:
    protocols:
      grpc:

processors:
  cost_exporter:
    pricing:
      auto_update: true
    metrics:
      labels:
        environment: production

exporters:
  prometheus:
    endpoint: "0.0.0.0:8888"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [cost_exporter]
      exporters: [prometheus]
```

### Pattern 3: Standalone Gateway

```
Application → OTLP → Cost Exporter Gateway → Prometheus/Backend
```

## Monitoring the Exporter

### Health Checks

```
GET /health    # Liveness probe
GET /ready     # Readiness probe
GET /metrics   # Prometheus metrics
```

### Key Metrics

```
# Exporter health
otel_cost_exporter_health{status="healthy"} 1

# Processing metrics
otel_cost_exporter_spans_processed_total{model="gpt-4"} 1000
otel_cost_exporter_spans_processed_total{model="claude-3-opus"} 500

# Cache metrics
otel_cost_exporter_cache_hits_total 950
otel_cost_exporter_cache_misses_total 50

# Error metrics
otel_cost_exporter_errors_total{type="unknown_model"} 5
otel_cost_exporter_errors_total{type="export_failed"} 2

# Pricing metrics
otel_cost_exporter_pricing_table_version{provider="openai"} 20240115
otel_cost_exporter_pricing_table_version{provider="anthropic"} 20240115
```

### Logging Levels

- **DEBUG**: Full span processing details
- **INFO**: Startup, configuration, periodic summaries
- **WARN**: Unknown models, missing tokens, cache misses
- **ERROR**: Export failures, configuration errors

## Extension Points

### Custom Pricing Providers

```typescript
export interface PricingProvider {
  getPrice(model: string): { inputPrice: number; outputPrice: number } | null;
  supports(model: string): boolean;
  update(): Promise<void>;
}
```

### Custom Exporters

```typescript
export interface MetricsExporter {
  export(metrics: CostMetric[]): Promise<void>;
  shutdown(): Promise<void>;
}
```

### Custom Normalizers

```typescript
export interface ModelNormalizer {
  normalize(modelName: string, system?: string): { provider: string; canonicalName: string };
  addAlias(alias: string, canonical: string): void;
}
```

## Testing Architecture

### Test Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Testing Pyramid                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│                      ┌───────┐                              │
│                     /         \                             │
│                    /    E2E    \                            │
│                   /   Tests     \                           │
│                  ───────────────                            │
│                 /                 \                         │
│                /   Integration     \                        │
│               /      Tests          \                       │
│              ────────────────────────                       │
│             /                         \                     │
│            /       Unit Tests          \                    │
│           ──────────────────────────────                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Test Data

- Mock spans with various GenAI attributes
- Sample pricing tables for different providers
- Fixture files for configuration testing
- Golden files for output validation

## Future Architecture Considerations

### Horizontal Scaling

- Stateless design enables horizontal scaling
- Consistent hashing for distributed aggregation
- Leader election for pricing updates

### Multi-Tenancy

- Namespace isolation for metrics
- Per-tenant pricing tables
- Resource quotas per tenant

### Stream Processing

- Integration with Kafka, Pulsar
- Windowed aggregation
- Exactly-once semantics

### Machine Learning

- Anomaly detection for cost spikes
- Predictive cost forecasting
- Automated budget alerts
