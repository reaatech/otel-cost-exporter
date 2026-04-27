import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        'eslint.config.mjs',
        'vitest.config.ts',
        'src/**/index.ts',
        'src/types/domain.ts',
        'src/pricing/types.ts',
        'src/exporter/types.ts',
        'src/cli.ts',
        'src/cli/',
        'src/index.ts',
        'src/semconv/version.ts',
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
      },
      watermarks: {
        statements: [70, 85],
        functions: [70, 85],
        branches: [70, 85],
        lines: [70, 85],
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  bench: {
    include: ['tests/**/*.bench.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
