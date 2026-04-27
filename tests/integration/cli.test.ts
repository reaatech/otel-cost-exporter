import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const cliPath = path.resolve(import.meta.dirname, '../../src/cli.ts');

describe('CLI integration', () => {
  describe('config command', () => {
    it('should output valid JSON', async () => {
      const { stdout } = await execFileAsync('tsx', [cliPath, 'config', '--format', 'json'], {
        env: { ...process.env },
      });

      const parsed: unknown = JSON.parse(stdout);
      expect(parsed).toBeDefined();
      expect(typeof parsed).toBe('object');

      const obj = parsed as Record<string, unknown>;
      expect(obj).toHaveProperty('default');
      expect(obj).toHaveProperty('active');

      const active = obj.active as Record<string, unknown>;
      expect(active).toHaveProperty('pricing');
      expect(active).toHaveProperty('metrics');
      expect(active).toHaveProperty('export');
      expect(active).toHaveProperty('logging');
    });

    it('should output valid YAML when --format yaml', async () => {
      const { stdout } = await execFileAsync('tsx', [cliPath, 'config', '--format', 'yaml'], {
        env: { ...process.env },
      });

      expect(stdout).toContain('default:');
      expect(stdout).toContain('active:');
      expect(stdout).toContain('pricing:');
    });
  });

  describe('validate command', () => {
    it('should succeed with valid pricing tables', async () => {
      const { stdout } = await execFileAsync('tsx', [cliPath, 'validate'], {
        env: { ...process.env },
      });

      expect(stdout).toContain('All pricing tables are valid.');
    });

    it('should report provider and model counts', async () => {
      const { stdout } = await execFileAsync('tsx', [cliPath, 'validate'], {
        env: { ...process.env },
      });

      expect(stdout).toContain('Pricing table version:');
      expect(stdout).toContain('Providers:');
      expect(stdout).toContain('openai:');
      expect(stdout).toContain('anthropic:');
      expect(stdout).toContain('Total models:');
    });
  });

  describe('report command', () => {
    it('should output JSON for a sample spans file', async () => {
      const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample-spans.json');
      const { stdout } = await execFileAsync(
        'tsx',
        [cliPath, 'report', '--input', fixturePath, '--format', 'json'],
        {
          env: { ...process.env },
        },
      );

      const parsed: unknown = JSON.parse(stdout);
      expect(Array.isArray(parsed)).toBe(true);

      const results = parsed as Array<Record<string, unknown>>;
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('spanId');
      expect(results[0]).toHaveProperty('totalCostUsd');
    });

    it('should output table format', async () => {
      const fixturePath = path.resolve(import.meta.dirname, '../fixtures/sample-spans.json');
      const { stdout } = await execFileAsync(
        'tsx',
        [cliPath, 'report', '--input', fixturePath, '--format', 'table'],
        {
          env: { ...process.env },
        },
      );

      expect(stdout).toContain('spanId');
      expect(stdout).toContain('Model');
      expect(stdout).toContain('Provider');
      expect(stdout).toContain('Total USD');
    });
  });
});
