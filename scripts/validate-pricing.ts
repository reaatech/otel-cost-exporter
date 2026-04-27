#!/usr/bin/env node
// Pricing table validation script — Phase 1 implementation
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'yaml';

const TABLES_DIR = join(import.meta.dirname, '..', 'pricing-tables');

const files = await readdir(TABLES_DIR);
let errors = 0;

for (const file of files.filter((f) => f.endsWith('.yaml'))) {
  const content = await readFile(join(TABLES_DIR, file), 'utf-8');
  try {
    const table = parse(content);
    if (!table?.providers) {
      console.error(`ERROR: ${file}: missing providers key`);
      errors++;
      continue;
    }
    console.log(`OK: ${file} (${Object.keys(table.providers).length} providers)`);
  } catch (err) {
    console.error(`ERROR: ${file}: ${(err as Error).message}`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n${errors} validation error(s) found`);
  process.exit(1);
}

console.log('\nAll pricing tables valid');
