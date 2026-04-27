export function parseIntervalMs(interval: string): number {
  const match = /^(\d+)(s|m|h|d|ms)$/.exec(interval);
  if (!match) return 60_000;

  const value = parseInt(match[1]!, 10);
  switch (match[2]) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60_000;
    case 'h':
      return value * 3_600_000;
    case 'd':
      return value * 86_400_000;
    default:
      return 60_000;
  }
}
