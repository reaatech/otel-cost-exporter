import { parseIntervalMs } from '@reaatech/otel-cost-exporter-core';
import { describe, expect, it } from 'vitest';

describe('parseIntervalMs', () => {
  it('should return 60000 for empty string', () => {
    expect(parseIntervalMs('')).toBe(60_000);
  });

  it('should return 60000 for invalid format', () => {
    expect(parseIntervalMs('not-an-interval')).toBe(60_000);
  });

  it('should parse milliseconds', () => {
    expect(parseIntervalMs('500ms')).toBe(500);
  });

  it('should parse seconds', () => {
    expect(parseIntervalMs('30s')).toBe(30_000);
    expect(parseIntervalMs('1s')).toBe(1_000);
  });

  it('should parse minutes', () => {
    expect(parseIntervalMs('5m')).toBe(300_000);
    expect(parseIntervalMs('1m')).toBe(60_000);
  });

  it('should parse hours', () => {
    expect(parseIntervalMs('2h')).toBe(7_200_000);
    expect(parseIntervalMs('1h')).toBe(3_600_000);
  });

  it('should parse days', () => {
    expect(parseIntervalMs('1d')).toBe(86_400_000);
    expect(parseIntervalMs('7d')).toBe(604_800_000);
  });

  it('should handle multi-digit values', () => {
    expect(parseIntervalMs('120s')).toBe(120_000);
    expect(parseIntervalMs('100m')).toBe(6_000_000);
  });

  it('should reject unknown suffixes', () => {
    expect(parseIntervalMs('10w')).toBe(60_000);
    expect(parseIntervalMs('10y')).toBe(60_000);
  });

  it('should reject negative values', () => {
    expect(parseIntervalMs('-5s')).toBe(60_000);
  });
});
