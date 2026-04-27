# Skill: Pricing Table Updates

<!--
  Implementation Status: PLANNING
  Target Phase: 3-4 (Integration / Production Readiness)
  Prerequisites: Phase 1 (Foundation), Phase 2 (Core Implementation)
  Note: Procedures reference targets (pnpm validate-pricing, pnpm pricing-diff,
        tsx scripts/validate-pricing.ts, tsx scripts/normalizer-test.ts) that
        will be built during implementation.
-->

## Overview

This skill provides procedures for updating pricing tables in the otel-cost-exporter system. Pricing tables contain the cost per token for various LLM models and must be kept current to ensure accurate cost calculations.

## When to Update

- **Scheduled Updates**: Weekly automated checks for provider price changes
- **Provider Announcements**: When OpenAI, Anthropic, Google, etc. announce price changes
- **New Model Releases**: When new models are released by providers
- **Error Corrections**: When pricing data is found to be incorrect

## Automated Update Procedure

### Prerequisites
- GitHub Actions workflow enabled
- AWS credentials for AWS Bedrock pricing (if applicable)
- API keys for provider pricing APIs (if applicable)

### Steps

1. **Trigger Update Workflow**
   ```bash
   # Manual trigger via GitHub Actions
   gh workflow run pricing-update.yaml

   # Or wait for scheduled run (default: every Monday at 00:00 UTC)
   ```

2. **Review Generated PR**
   The workflow will:
   - Fetch latest pricing from providers
   - Compare with current pricing tables
   - Generate a PR if changes detected
   - Run validation tests

3. **Validate Changes**
   ```bash
   # Checkout the PR branch
   git checkout pricing-update-$(date +%Y%m%d)

   # Run pricing validation
   pnpm validate-pricing

   # Run full test suite
   pnpm test

   # Check diff summary
   pnpm pricing-diff
   ```

4. **Merge and Release**
   ```bash
   # After approval, merge the PR
   gh pr merge --squash --delete-branch

   # The release workflow will automatically:
   # - Bump patch version
   # - Create GitHub release
   # - Publish to package registries
   ```

## Manual Update Procedure

### Step 1: Gather Pricing Information

#### OpenAI
```bash
# Fetch current OpenAI pricing
curl -s https://openai.com/api/pricing/ | \
  grep -A 20 "GPT-4" > /tmp/openai-pricing.html

# Or use the official API (requires API key)
curl -s -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models | jq '.data[] | {id, pricing}'
```

#### Anthropic
```bash
# Anthropic pricing from documentation
curl -s https://www.anthropic.com/api/pricing | \
  jq '.models[] | {name, input_price, output_price}'
```

#### Google Gemini
```bash
# Google AI pricing
curl -s https://cloud.google.com/vertex-ai/pricing | \
  grep -A 10 "Gemini"
```

#### AWS Bedrock
```bash
# AWS Bedrock pricing (requires AWS CLI)
aws bedrock list-foundation-models --query 'modelSummaries[*].[modelId,modelLifecycle]' --output table
aws pricing get-products --service-code AmazonBedrock --filters Type=TERM_MATCH,Field=productFamily,Value="Foundation Models"
```

### Step 2: Update Pricing Tables

1. **Locate the pricing table file**
   ```bash
   # Provider pricing tables are in:
   ls pricing-tables/
   # Output: anthropic.yaml aws-bedrock.yaml azure.yaml google.yaml openai.yaml
   ```

2. **Edit the pricing table**
   ```bash
   # Example: Update OpenAI pricing
   vim pricing-tables/openai.yaml
   ```

3. **Update the version and timestamp**
   ```yaml
   # At the top of the file:
   version: "2024.01.15"  # YYYY.MM.DD format
   last_updated: "2024-01-15T00:00:00Z"
   ```

4. **Update model prices**
   ```yaml
   providers:
     openai:
       models:
          gpt-4:
            input_token_price: 30.0    # USD per 1,000,000 tokens
            output_token_price: 60.0   # USD per 1,000,000 tokens
            effective_date: "2024-01-01"
         # Add or update other models...
   ```

### Step 3: Validate Changes

```bash
# Run pricing table validation
pnpm validate-pricing

# Expected output:
# ✓ YAML syntax valid
# ✓ All required fields present
# ✓ Prices are positive numbers
# ✓ Effective dates are valid
# ✓ No duplicate model entries

# Run tests
pnpm test

# Check pricing diff
pnpm pricing-diff

# Expected output shows changes:
# Model: gpt-4
#   input_token_price: 30.00 -> 35.00 (+16.7%)
#   output_token_price: 60.00 -> 70.00 (+16.7%)
```

### Step 4: Update Version

```bash
# Bump patch version for pricing updates
pnpm bump-patch

# Or manually update version files:
# - src/semconv/version.ts
# - src/pricing/version.ts
# - CHANGELOG.md
```

### Step 5: Commit and Push

```bash
# Create commit with conventional commit format
git add pricing-tables/
git commit -m "chore(pricing): update OpenAI pricing for GPT-4 models

- GPT-4 input: $30.00 -> $35.00 per 1M tokens
- GPT-4 output: $60.00 -> $70.00 per 1M tokens
- Effective: 2024-01-15

Resolves: pricing-update-2024-01"

git push origin main
```

## Rollback Procedures

### Quick Rollback

If a pricing update causes issues:

```bash
# Revert to previous version
git revert HEAD

# Or checkout specific previous version
git checkout <previous-commit> -- pricing-tables/

# Rebuild and redeploy
pnpm build
pnpm deploy
```

### Emergency Rollback

For critical issues:

1. **Set default price override**
   ```yaml
   # In configuration:
   pricing:
     default_price: 0.002  # Conservative fallback
   ```

2. **Disable auto-update**
   ```yaml
   pricing:
     auto_update: false
   ```

3. **Deploy hotfix**
   ```bash
   git checkout <stable-tag>
   pnpm deploy-emergency
   ```

## Validation Checklist

Before merging any pricing update:

- [ ] YAML syntax is valid
- [ ] All required fields are present
- [ ] Prices are positive numbers
- [ ] Effective dates are in the past or today
- [ ] No duplicate model entries
- [ ] Version number is incremented
- [ ] CHANGELOG is updated
- [ ] Tests pass
- [ ] Pricing diff is reviewed and approved
- [ ] Source of pricing change is documented

## Pricing Sources

### Official Sources

| Provider | URL | Update Frequency |
|----------|-----|------------------|
| OpenAI | https://openai.com/api/pricing/ | As announced |
| Anthropic | https://www.anthropic.com/api/pricing | As announced |
| Google | https://cloud.google.com/vertex-ai/pricing | Monthly |
| AWS Bedrock | https://aws.amazon.com/bedrock/pricing/ | Monthly |
| Azure OpenAI | https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/ | Monthly |

### Community Sources

- [LM Pricing Database](https://github.com/reaatech/lm-pricing) - Community-maintained
- [OpenAI Models API](https://api.openai.com/v1/models) - Real-time data
- [Anthropic API](https://docs.anthropic.com/claude/reference/models) - API documentation

## Best Practices

1. **Always verify against official sources** - Don't rely solely on automated tools
2. **Document the source** - Include URL and date of pricing information
3. **Test with real spans** - Verify calculations with sample data
4. **Monitor for errors** - Watch for "unknown model" errors after updates
5. **Communicate changes** - Notify users of significant price changes

## Troubleshooting

### Issue: Pricing validation fails

```bash
# Check YAML syntax with automated validation
pnpm validate-pricing

# Validate schema programmatically
tsx scripts/validate-pricing.ts
```

### Issue: Tests fail after update

```bash
# Run specific pricing tests
pnpm vitest run tests/unit/pricing

# Check for calculation errors
pnpm vitest run tests/unit/calculator
```

### Issue: Model not found after update

```bash
# Check model name normalization
tsx scripts/normalizer-test.ts --model "gpt-4-turbo"

# Add alias if needed
# Edit src/calculator/normalizer.ts
```
