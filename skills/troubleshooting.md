# Skill: Troubleshooting

<!--
  Implementation Status: PLANNING
  Target Phase: 3-4 (Integration / Production Readiness)
  Prerequisites: Phase 1 (Foundation), Phase 2 (Core Implementation)
  Note: Debug endpoints (/debug/*) are Phase 3 implementation items.
        Commands referencing scripts/normalizer-test.ts will be built in Phase 2.
-->

## Overview

This comprehensive troubleshooting guide helps diagnose and resolve common issues with the otel-cost-exporter system. It covers error scenarios, debug procedures, performance tuning, and recovery procedures.

## Quick Reference

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| "unknown model" errors | Model not in pricing table | Add model to pricing table or set default price |
| High memory usage | Cache too large | Reduce cache size in config |
| Export failures | Network issues | Check connectivity, increase retry count |
| Slow processing | No batching | Enable batch processing in config |
| Incorrect costs | Wrong pricing | Update pricing table |
| Missing metrics | Span attributes missing | Check instrumentation |

## Debug Mode

### Enabling Debug Logging

```yaml
# config.yaml
cost_exporter:
  logging:
    level: debug
    format: json
    output: stdout
```

Tip: Pino will automatically pick up the `level` and format from this config. Set `COST_EXPORTER_LOG_LEVEL=debug` as an env-var alternative.

### CLI Debug Flags

```bash
# Run the CLI with verbose debug output
otel-cost-exporter serve --config=config.yaml --debug --verbose

# Or run via node directly
node packages/cli/dist/cli.js serve --config=config.yaml --debug --verbose
```

### Debug Endpoints

```bash
# Health check
curl http://localhost:8888/health

# Readiness check
curl http://localhost:8888/ready

# Current configuration
curl http://localhost:8888/debug/config

# Pricing table status
curl http://localhost:8888/debug/pricing

# Cache statistics
curl http://localhost:8888/debug/cache

# Active spans being processed
curl http://localhost:8888/debug/spans
```

## Common Error Scenarios

### 1. Unknown Model Errors

**Error Message:**
```
{"level":30,"msg":"unknown model","model":"gpt-4-turbo-2024-01-01","provider":"unknown"}
```

**Causes:**
- Model not in pricing table
- Model name mismatch (alias not configured)
- Provider detection failed

**Diagnosis:**
```bash
# Check if model exists in pricing table (now under packages/pricing/)
rg "gpt-4-turbo-2024-01-01" packages/pricing/pricing-tables/

# Test model normalization (via calculator package)
tsx scripts/normalizer-test.ts --model "gpt-4-turbo-2024-01-01"

# Check pricing lookup via debug endpoint
curl -X POST http://localhost:8888/debug/pricing \
  -d '{"model": "gpt-4-turbo-2024-01-01"}'
```

**Solutions:**
1. **Add model to pricing table**
   ```yaml
   # packages/pricing/pricing-tables/openai.yaml
   providers:
     openai:
       models:
         gpt-4-turbo-2024-01-01:
           input_token_price: 0.01
           output_token_price: 0.03
   ```

2. **Add model alias**
   ```typescript
   // packages/calculator/src/normalizer.ts
   const MODEL_ALIASES: Record<string, string> = {
     'gpt-4-turbo-2024-01-01': 'openai/gpt-4-turbo',
   };
   ```

3. **Set default price**
   ```yaml
   # config.yaml
   cost_exporter:
     pricing:
       default_price: 0.002  # Fallback price per 1K tokens
   ```

### 2. High Memory Usage

**Symptoms:**
- Memory usage growing over time (RSS seen via `process.memoryUsage()`)
- OOM kills
- Slow performance from GC pressure

**Diagnosis:**
```bash
# Run with the Node.js inspector to capture a heap snapshot
node --inspect-brk --enable-source-maps packages/cli/dist/cli.js serve --config=config.yaml

# Or use clinic.js to generate a flamegraph / heap profile
clinic doctor -- node packages/cli/dist/cli.js serve --config=config.yaml

# Check cache statistics
curl http://localhost:8888/debug/cache

# Monitor memory metrics
curl http://localhost:8888/metrics | grep memory
```

**Solutions:**
1. **Reduce cache size**
   ```yaml
   # config.yaml
   cost_exporter:
     cache:
       max_entries: 1000    # Reduce from default
       ttl: 1h              # Shorter TTL
   ```

2. **Enable memory limits**
   ```yaml
   # config.yaml
   cost_exporter:
     resources:
       memory_limit: 512Mi
   ```

3. **Tune batch processing**
   ```yaml
   # config.yaml
   cost_exporter:
     processor:
       batch_size: 50       # Smaller batches
       batch_timeout: 1s    # Faster flush
   ```

### 3. Export Failures

**Error Message:**
```
{"level":50,"msg":"export failed","error":"connection refused","endpoint":"http://prometheus:9090"}
```

**Causes:**
- Network connectivity issues
- Export endpoint unavailable
- Authentication failures
- Timeout issues

**Diagnosis:**
```bash
# Test endpoint connectivity
curl -v http://prometheus:9090/api/v1/write

# Check export metrics
curl http://localhost:8888/metrics | grep export

# View export logs
kubectl logs -f deployment/otel-cost-exporter | grep export
```

**Solutions:**
1. **Check network connectivity**
   ```bash
   # Test DNS resolution
   nslookup prometheus

   # Test port connectivity
   nc -zv prometheus 9090
   ```

2. **Increase retry configuration**
   ```yaml
   # config.yaml
   cost_exporter:
     export:
       retry:
         max_attempts: 5
         initial_interval: 1s
         max_interval: 30s
   ```

3. **Enable export buffering**
   ```yaml
   # config.yaml
   cost_exporter:
     export:
       buffer:
         enabled: true
         max_size: 10000
   ```

### 4. Slow Processing

**Symptoms:**
- High latency in span processing
- Backlog of unprocessed spans
- Timeout errors

**Diagnosis:**
```bash
# Check processing metrics
curl http://localhost:8888/metrics | grep process

# Profile CPU usage with Node.js inspector (30s sampling)
node --inspect --cpu-prof packages/cli/dist/cli.js serve --config=config.yaml & sleep 30 && kill %1

# Alternatively use clinic.js flamegraph
clinic flame -- node packages/cli/dist/cli.js serve --config=config.yaml

# Check span queue
curl http://localhost:8888/debug/queue
```

**Solutions:**
1. **Enable batch processing**
   ```yaml
   # config.yaml
   cost_exporter:
     processor:
       batch:
         enabled: true
         size: 100
         timeout: 5s
   ```

2. **Increase worker count**
   ```yaml
   # config.yaml
   cost_exporter:
     processor:
       workers: 4
   ```

3. **Optimize pricing lookups**
   ```yaml
   # config.yaml
   cost_exporter:
     cache:
       enabled: true
       size: 10000
       ttl: 24h
   ```

### 5. Incorrect Cost Calculations

**Symptoms:**
- Costs don't match expected values
- Discrepancy with provider bills
- Negative or zero costs

**Diagnosis:**
```bash
# Test cost calculation via debug endpoint
curl -X POST http://localhost:8888/debug/calculate \
  -d '{"model": "gpt-4", "input_tokens": 1000, "output_tokens": 500}'

# Check pricing table for a specific provider
curl http://localhost:8888/debug/pricing?provider=openai

# Verify token extraction
curl http://localhost:8888/debug/span/parse \
  -d '{"attributes": {"gen_ai.usage.input_tokens": 1000}}'
```

**Solutions:**
1. **Update pricing table**
   ```bash
   # Fetch latest pricing
   pnpm generate-pricing

   # Validate pricing
   pnpm validate-pricing
   ```

2. **Check calculation formula**
   ```typescript
   // Verify in packages/calculator/src/calculator.ts
   const TOKENS_PER_UNIT = 1_000_000;

   export function calculateCost(
     entry: PriceEntry,
     inputTokens: number,
     outputTokens: number,
   ): { inputCost: number; outputCost: number; totalCost: number } {
     const inputCost = (inputTokens / TOKENS_PER_UNIT) * entry.inputTokenPrice;
     const outputCost = (outputTokens / TOKENS_PER_UNIT) * entry.outputTokenPrice;
     return {
       inputCost,
       outputCost,
       totalCost: inputCost + outputCost,
     };
   }
   ```

3. **Verify token counts**
   ```yaml
   # Ensure spans have correct attributes
   gen_ai.usage.input_tokens: 1000   # Must be number
   gen_ai.usage.output_tokens: 500   # Must be number
   ```

### 6. Missing Metrics

**Symptoms:**
- No metrics exported
- Metrics endpoint returns empty
- Prometheus shows no data

**Diagnosis:**
```bash
# Check metrics endpoint
curl http://localhost:8888/metrics

# Check span reception
curl http://localhost:8888/debug/stats

# Verify configuration
curl http://localhost:8888/debug/config
```

**Solutions:**
1. **Check span attributes**
   ```yaml
   # Required attributes in spans:
   gen_ai.request.model: "gpt-4"
   gen_ai.usage.input_tokens: 1000
   gen_ai.usage.output_tokens: 500
   ```

2. **Verify export configuration**
   ```yaml
   # config.yaml
   cost_exporter:
     export:
       format: prometheus
       port: 8888
       path: /metrics
   ```

3. **Check processor pipeline**
   ```yaml
   # For OTel Collector configuration
   service:
     pipelines:
       traces:
         receivers: [otlp]
         processors: [cost_exporter]  # Ensure processor is included
         exporters: [prometheus]
   ```

## Performance Tuning

### Memory Optimization

```yaml
# config.yaml
cost_exporter:
  cache:
    # Reduce cache size for memory-constrained environments
    max_entries: 500
    ttl: 1h

    # Enable cache compression
    compress: true

  processor:
    # Reduce batch size to lower memory usage
    batch_size: 25
    batch_timeout: 2s
```

### CPU Optimization

```yaml
# config.yaml
cost_exporter:
  processor:
    # Increase workers for CPU-bound workloads
    workers: 8

    # Enable parallel processing
    parallel: true

  cache:
    # Increase cache to reduce CPU for lookups
    max_entries: 10000
    ttl: 24h
```

### Network Optimization

```yaml
# config.yaml
cost_exporter:
  export:
    # Enable compression for OTLP export
    compression: gzip

    # Batch exports to reduce network calls
    batch:
      enabled: true
      max_size: 1000
      timeout: 10s
```

## Recovery Procedures

### Restart with Clean State

```bash
# Stop the exporter
kubectl delete pod -l app=otel-cost-exporter

# Clear cache (if using persistent cache)
rm -rf /var/lib/otel-cost-exporter/cache/*

# Start fresh
kubectl apply -f deployments/kubernetes/deployment.yaml
```

### Rollback to Previous Version

```bash
# List available Docker image tags
gh api repos/reaatech/otel-cost-exporter/packages/container/otel-cost-exporter/versions

# Deploy previous version
kubectl set image deployment/otel-cost-exporter \
  otel-cost-exporter=ghcr.io/reaatech/otel-cost-exporter:<previous-tag>
```

### Emergency Pricing Override

```yaml
# config.yaml - Set conservative fallback pricing
cost_exporter:
  pricing:
    # Override all pricing with safe defaults
    force_default_price: 0.002

    # Disable auto-updates temporarily
    auto_update: false

    # Use bundled tables only
    custom_table_path: ""
```

## Diagnostic Commands

### System Health

```bash
# Full system health check
curl http://localhost:8888/health
curl http://localhost:8888/ready
curl http://localhost:8888/live

# Get system info
curl http://localhost:8888/debug/info
```

### Pricing Diagnostics

```bash
# List all supported models
curl http://localhost:8888/debug/models

# Check specific model pricing
curl "http://localhost:8888/debug/pricing?model=gpt-4"

# Get pricing table version
curl http://localhost:8888/debug/pricing/version

# Test pricing lookup
curl -X POST http://localhost:8888/debug/pricing/lookup \
  -d '{"provider": "openai", "model": "gpt-4"}'
```

### Span Processing Diagnostics

```bash
# Get processing statistics
curl http://localhost:8888/debug/stats

# View recent processed spans
curl http://localhost:8888/debug/spans/recent

# Test span processing
curl -X POST http://localhost:8888/debug/span/process \
  -d '{
    "name": "chat",
    "attributes": {
      "gen_ai.request.model": "gpt-4",
      "gen_ai.usage.input_tokens": 1000,
      "gen_ai.usage.output_tokens": 500
    }
  }'
```

### Cache Diagnostics

```bash
# Get cache statistics
curl http://localhost:8888/debug/cache/stats

# View cache entries
curl http://localhost:8888/debug/cache/entries

# Clear cache
curl -X DELETE http://localhost:8888/debug/cache

# Warm cache
curl -X POST http://localhost:8888/debug/cache/warm
```

## Logging Reference

otel-cost-exporter uses Pino for structured JSON logging. The logger is configured via the `cost_exporter.logging` block or the `COST_EXPORTER_LOG_LEVEL` environment variable.

### Log Levels

| Level | Pino Value | When to Use |
|-------|-----------|-------------|
| DEBUG | 20 | Detailed troubleshooting, development |
| INFO | 30 | Normal operation, startup, periodic summaries |
| WARN | 40 | Recoverable issues, fallbacks used |
| ERROR | 50 | Failures that need attention |
| FATAL | 60 | Unrecoverable failures requiring restart |

### Key Log Messages

| Message | Meaning | Action |
|---------|---------|--------|
| `"span processed"` | Successful span processing | None |
| `"unknown model"` | Model not in pricing table | Add model or set default |
| `"cache miss"` | Pricing not in cache | Normal, will be cached |
| `"export failed"` | Metrics export failed | Check connectivity |
| `"pricing updated"` | Pricing table reloaded | None |
| `"config reloaded"` | Configuration reloaded | Verify changes |

## Getting Help

### Internal Resources

1. **Documentation**: Check `docs/` directory
2. **Skills**: Review `skills/` directory for specific procedures
3. **Issues**: Search existing GitHub issues
4. **Discussions**: Check GitHub Discussions

### External Resources

1. **OpenTelemetry Docs**: https://opentelemetry.io/docs/
2. **GenAI Conventions**: https://opentelemetry.io/docs/specs/semconv/gen-ai/
3. **Community Slack**: Join OTel Slack for help

### Reporting Issues

When reporting issues, include:

1. **Version information**
   ```bash
   otel-cost-exporter --version
   ```

2. **Configuration** (sanitized)
   ```yaml
   # Share relevant config sections
   ```

3. **Logs**
   ```bash
   # Collect recent logs
   kubectl logs --tail=100 deployment/otel-cost-exporter
   ```

4. **Metrics**
   ```bash
   # Export current metrics
   curl http://localhost:8888/metrics > metrics.txt
   ```

5. **Steps to reproduce**
   - Detailed steps to reproduce the issue
   - Expected vs actual behavior
