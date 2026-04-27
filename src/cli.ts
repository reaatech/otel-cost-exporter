#!/usr/bin/env node
import { Command } from 'commander';
import { readFile } from 'node:fs/promises';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

const program = new Command();

program
  .name('otel-cost-exporter')
  .description('OpenTelemetry-native cost metrics for every LLM call')
  .version(pkg.version);

program
  .command('serve')
  .description('Start the collector processor with OTLP receiver and Prometheus metrics')
  .option('--config <path>', 'Path to YAML config file')
  .option('--port <number>', 'Port for OTLP HTTP receiver', '4317')
  .option('--metrics-port <number>', 'Port for Prometheus metrics', '8888')
  .action(async (options: { config?: string; port: string; metricsPort: string }) => {
    const { serveCommand } = await import('./cli/commands/serve.command.js');
    await serveCommand({
      config: options.config,
      port: parseInt(options.port, 10),
      metricsPort: parseInt(options.metricsPort, 10),
    });
  });

program
  .command('report')
  .description('Read spans from file/stdin and calculate costs')
  .option('--input <path>', 'Path to JSON file containing CostSpan array')
  .option('--format <format>', 'Output format (json or table)', 'json')
  .option('--environment <env>', 'Filter spans by deployment environment')
  .action(async (options: { input?: string; format: string; environment?: string }) => {
    const format = options.format === 'table' ? 'table' : 'json';
    const { reportCommand } = await import('./cli/commands/report.command.js');
    await reportCommand({ input: options.input, format, environment: options.environment });
  });

program
  .command('config')
  .description('Show current configuration with defaults and env overrides')
  .option('--format <format>', 'Output format (json or yaml)', 'json')
  .action(async (options: { format: string }) => {
    const format = options.format === 'yaml' ? 'yaml' : 'json';
    const { configCommand } = await import('./cli/commands/config.command.js');
    await configCommand({ format });
  });

program
  .command('validate')
  .description('Validate all pricing tables')
  .action(async () => {
    const { validateCommand } = await import('./cli/commands/validate.command.js');
    await validateCommand();
  });

program.parse();
