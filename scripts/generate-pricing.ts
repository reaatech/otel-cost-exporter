#!/usr/bin/env node
/**
 * Pricing table generation script.
 *
 * Automatically fetches latest pricing from provider APIs/websites
 * and updates the bundled pricing tables in pricing-tables/.
 *
 * @todo Phase 3 — Not yet implemented.
 *       Will support fetching from OpenAI, Anthropic, Google, AWS Bedrock,
 *       and Azure pricing endpoints and converting to YAML format.
 */
import process from 'node:process';

console.error(
  'generate-pricing: Not yet implemented (tracked as Phase 3 feature).\n' +
  'For now, update pricing tables manually in pricing-tables/.\n' +
  'See skills/pricing-update.md for manual update procedures.',
);
process.exit(1);
