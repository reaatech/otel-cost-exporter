# Skill: Code Review

<!--
  Implementation Status: ACTIVE
  Target Phase: All phases
-->

## Overview

This skill provides a structured code review checklist for the otel-cost-exporter project. It ensures consistency, security, and quality across all contributions.

## Review Checklist

### Security

- [ ] No secrets, tokens, API keys, or credentials in code
- [ ] No LLM content, prompts, or PII logged or stored
- [ ] Input validation present for all external inputs
- [ ] Configuration values validated against Zod schemas
- [ ] Error messages do not leak sensitive information
- [ ] Dependencies have no known vulnerabilities (`pnpm audit`)
- [ ] No `eval()` or `new Function()` usage

### Correctness

- [ ] All functions have explicit return types
- [ ] Error paths are handled (no uncaught rejections)
- [ ] Token counts are validated as non-negative integers
- [ ] Cost calculations match provider pricing formulas
- [ ] Pricing table lookups handle missing models gracefully
- [ ] Edge cases covered (empty spans, zero tokens, unknown models)

### Performance

- [ ] No blocking operations in hot paths
- [ ] Cache used for repeated pricing lookups
- [ ] No unnecessary allocations in span processing
- [ ] Batch processing available where applicable
- [ ] Resource cleanup (timers, intervals, event listeners)

### Testing

- [ ] Unit tests for every exported function
- [ ] Tests cover both success and error paths
- [ ] Edge cases have dedicated test cases
- [ ] Mock external dependencies (pricing sources, SDKs)
- [ ] No flaky tests (no timeouts, no network calls)
- [ ] Coverage meets or exceeds 85% threshold

### Code Quality

- [ ] TypeScript strict mode passes (`tsc --noEmit`)
- [ ] Biome passes without errors (`pnpm lint`)
- [ ] Biome formatting applied (`pnpm format`)
- [ ] No `any` types in production code (tests excluded)
- [ ] Functions are small and focused (< 50 lines preferred)
- [ ] Naming follows conventions (see AGENTS.md)
- [ ] Comments explain "why" not "what"
- [ ] No commented-out code blocks
- [ ] Import paths use workspace package names (`@reaatech/otel-cost-exporter-*`) or `.js` relative imports
- [ ] Exports are explicit (no barrel-file re-export abuse)

### Documentation

- [ ] JSDoc comments on all exported functions/types
- [ ] Configuration options documented in `docs/configuration.md`
- [ ] CHANGELOG updated for user-facing changes
- [ ] README updated if new features or changed behavior
- [ ] Pricing table changes documented with source URL and date
- [ ] Architecture decisions documented in ARCHITECTURE.md if structural

### OTel Conventions

- [ ] Follows GenAI semantic convention attributes
- [ ] Metric names use dot-separated convention
- [ ] Labels include at minimum: model, provider, service
- [ ] Uses `gen_ai.system` as primary provider signal
- [ ] No span content stored or exported

### Integration

- [ ] Collector service tested
- [ ] In-process exporter mode tested
- [ ] Prometheus export format tested
- [ ] OTLP export format tested
- [ ] Configuration hot-reload tested
- [ ] Graceful shutdown tested

## Review Process

1. **Self-review**: Author runs full pre-commit before requesting review
2. **Automated checks**: CI must pass (lint + typecheck + test + audit)
3. **Peer review**: At least one maintainer approves
4. **Address feedback**: Respond to all comments, re-request review
5. **Merge**: Squash-merge to main after approval

## Common Anti-Patterns to Watch For

| Anti-Pattern | Why It's Bad | What to Suggest |
|-------------|--------------|-----------------|
| `any` type in production code | Nullifies type safety | Use `unknown` + type guard, or proper generic |
| `console.log` in production | Uncontrolled output | Use `pino` logger with appropriate level |
| Catching and swallowing errors | Hides problems | Log and re-throw, or handle explicitly |
| Mutating input parameters | Surprising side effects | Clone or use immutable patterns |
| Hardcoded pricing values | Stale data | Load from bundled pricing tables |
| Synchronous file I/O | Blocks event loop | Use `fs/promises` or async patterns |
| No timeout on fetch | Hangs on slow endpoints | Add `AbortController` with configurable timeout |
| Double-await in hot path | Unnecessary microtick | Await once, reuse result |

## PR Comment Templates

### Requesting Changes

```
**Status: Changes Requested**

I've left comments inline. Key areas to address:

1. [specific concern]
2. [specific concern]

Please re-request review after updates.
```

### Approving

```
**Status: Approved**

LGTM. [Optional: brief summary of what looks good].

Please squash-merge when ready.
```

### Flagging Security Concern

```
**Status: Security Concern**

This change involves [describe concern]. Before merging, please:

1. Verify no secrets are exposed: [specific check]
2. Confirm input validation: [specific check]
3. Run `pnpm audit --audit-level=high` and attach output

Security concerns are tracked in security-review.md skill.
```
