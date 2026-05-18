import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  esbuildOptions(options, ctx) {
    options.define = {
      ...options.define,
      __MODULE_DIRNAME__: ctx.format === 'cjs' ? '__dirname' : 'import.meta.dirname',
    };
  },
});
