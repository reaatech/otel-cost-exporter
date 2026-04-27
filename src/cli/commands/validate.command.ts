/* eslint-disable no-console */

import { loadPricingData } from '@/pricing/loader.js';

export async function validateCommand(): Promise<void> {
  let exitCode = 0;

  try {
    const data = await loadPricingData();

    console.log(`Pricing table version: ${data.version}`);
    console.log(`Last updated: ${data.lastUpdated}`);
    console.log(`Providers: ${data.providers.size}`);

    let totalModels = 0;
    for (const [provider, models] of data.providers) {
      console.log(`  ${provider}: ${models.size} models`);
      totalModels += models.size;

      for (const [model, entry] of models) {
        if (entry.inputTokenPrice <= 0) {
          console.error(
            `  ERROR: ${provider}/${model} has invalid input price: ${entry.inputTokenPrice}`,
          );
          exitCode = 1;
        }
        if (entry.outputTokenPrice <= 0) {
          console.error(
            `  ERROR: ${provider}/${model} has invalid output price: ${entry.outputTokenPrice}`,
          );
          exitCode = 1;
        }
      }
    }

    console.log(`Total models: ${totalModels}`);

    if (totalModels === 0) {
      console.error('ERROR: No models found in pricing tables');
      exitCode = 1;
    }
  } catch (err) {
    console.error('ERROR: Failed to load pricing tables:', (err as Error).message);
    exitCode = 1;
  }

  if (exitCode === 0) {
    console.log('All pricing tables are valid.');
  }

  process.exit(exitCode);
}
