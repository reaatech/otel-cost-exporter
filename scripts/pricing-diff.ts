#!/usr/bin/env node
/**
 * Pricing diff script.
 *
 * Compares the current bundled pricing tables against a reference
 * (e.g., a previous commit, a remote source) and outputs the difference.
 *
 * @todo Phase 3 — Not yet implemented.
 *       Will show added/removed/modified models and price changes.
 */
import process from 'node:process';

console.error(
  'pricing-diff: Not yet implemented (tracked as Phase 3 feature).\n' +
    'Run `git diff pricing-tables/` to manually review pricing changes.',
);
process.exit(1);
