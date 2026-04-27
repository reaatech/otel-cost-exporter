# Skill: Documentation Maintenance

<!--
  Implementation Status: ACTIVE
  Target Phase: All phases
-->

## Overview

This skill provides guidelines for maintaining documentation across the otel-cost-exporter project. Documentation is a first-class deliverable treated with the same rigor as production code.

## Documentation Map

| Document | Audience | Update Trigger |
|----------|----------|---------------|
| `README.md` | First-time visitors, evaluators | New features, API changes, major releases |
| `ARCHITECTURE.md` | Contributors, code reviewers | Structural changes, new components |
| `DEV_PLAN.md` | Contributors, maintainers | Phase progress, new phases |
| `AGENTS.md` | AI agents, contributors | Code style changes, new patterns |
| `CONTRIBUTING.md` | Contributors | Process changes, new tooling |
| `CHANGELOG.md` | All users | Every release |
| `docs/configuration.md` | Operators | New config options |
| `docs/pricing-tables.md` | Operators, contributors | New providers, pricing model changes |
| `docs/getting-started.md` | New users | Onboarding friction points |
| `docs/troubleshooting.md` | Operators | New common issues, new debug endpoints |
| `skills/*.md` | AI agents, contributors | New procedures, process changes |
| JSDoc (in code) | Developers | New functions/types, behavior changes |

## README.md Standards

The README is the project's front door. It must:

1. **State the problem** in the first paragraph
2. **Show working code** within 30 seconds of reading
3. **List key features** as bullet points
4. **Provide a quick start** that actually works
5. **Link to deeper docs** for details

### Structure

```markdown
# Project Name

One-line description.

[Badges: npm version, build status, coverage, license]

## Problem Statement
1-2 sentences on what this solves.

## Features
- Bullet list of capabilities

## Quick Start
```code block that works```

## Documentation
- Links to docs/ and ARCHITECTURE.md

## Supported Providers
Table of providers and models

## Configuration
Minimal working config example

## Contributing
Brief + link to CONTRIBUTING.md

## License
License name + link to LICENSE
```

## ARCHITECTURE.md Standards

Update when:
- Component responsibilities change
- New deployment patterns added
- Data flow changes
- Concurrency model changes
- Extension points added or modified

### Required Sections

1. **System Overview** — High-level diagram
2. **Design Principles** — What drives decisions
3. **Component Architecture** — What lives where
4. **Data Flow** — How data moves through the system
5. **Configuration System** — Config hierarchy and schema
6. **Performance Considerations** — Caching, batching, concurrency
7. **Error Handling** — Error categories and degradation strategy
8. **Security Model** — What is and isn't protected
9. **Deployment Patterns** — How to run in production

## DEV_PLAN.md Standards

Update when:
- Phase completed: mark phase items `[x]`
- New phase added: append to end
- Phase timeline changes: update dates

### Structure

Each phase must include:
- Phase number and week range
- Bullet-point tasks with checkboxes `[ ]`
- Dependencies on prior phases noted

## CHANGELOG.md Standards

Follow [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

### Entry Format

```markdown
## [1.2.0] - 2024-01-15

### Added
- New capability
- New feature

### Changed
- Behavioral change
- Updated dependency

### Fixed
- Bug description

### Security
- Security fix description
```

### Conventions

- Newest entry first (reverse chronological)
- Link version headers to GitHub compare URLs
- Use `[Unreleased]` for pending changes
- Categorize every change under Added/Changed/Fixed/Removed/Security
- Reference issue numbers where applicable

## JSDoc Standards

Every exported function, type, interface, and class must have JSDoc.

### Function Documentation

```typescript
/**
 * Calculates the cost for a given model and token counts.
 *
 * @param entry - Pricing entry for the model
 * @param inputTokens - Number of input tokens consumed
 * @param outputTokens - Number of output tokens generated
 * @returns An object containing input cost, output cost, and total cost in USD
 * @throws {PricingError} If the pricing entry is invalid or missing
 *
 * @example
 * ```typescript
 * const { inputCost, outputCost, totalCost } = calculateCost(
 *   pricingEntry,
 *   1000000,
 *   500000,
 * );
 * console.log(`Total: $${totalCost.toFixed(4)}`);
 * ```
 */
export function calculateCost(
  entry: PriceEntry,
  inputTokens: number,
  outputTokens: number,
): CostBreakdown {
  // ...
}
```

### Interface Documentation

```typescript
/**
 * Represents pricing information for a specific LLM model.
 * All prices are in USD per 1,000,000 tokens.
 */
export interface PriceEntry {
  /** Price per 1,000,000 input tokens in USD */
  inputTokenPrice: number;

  /** Price per 1,000,000 output tokens in USD */
  outputTokenPrice: number;

  /** ISO 8601 date when this pricing became effective */
  effectiveDate: string;
}
```

## Skills Directory Standards

Each skill file must include:

1. **Frontmatter header** with implementation status and target phase
2. **Overview** explaining when to use the skill
3. **Step-by-step procedures** with executable commands
4. **Troubleshooting** section for common failures
5. **Best practices** section

### Skill File Template

```markdown
# Skill: [Name]

<!--
  Implementation Status: [PLANNING | ACTIVE | MATURE]
  Target Phase: [0-6]
  Prerequisites: [phase dependencies]
-->

## Overview

[1-2 sentences on what this skill covers]

## When to Use

[Bullet list of triggering conditions]

## Procedure

### Step 1: [Name]
[Details with code blocks]

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|

## Best Practices

1. [Practice]
```

## Review Checklist for Documentation PRs

- [ ] Spelling and grammar checked
- [ ] Code examples are runnable (copy-paste works)
- [ ] Links are valid (not broken)
- [ ] No placeholder text or "TODO" left in
- [ ] Cross-references between docs are updated
- [ ] Diagrams updated if architecture changed
- [ ] Version references updated if applicable
