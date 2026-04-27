import pino from 'pino';
import type { Logger } from 'pino';

export function createLogger(level: string = 'info', format: string = 'json'): Logger {
  const opts: pino.LoggerOptions = { level };

  if (format !== 'json') {
    try {
      opts.transport = {
        target: 'pino-pretty',
        options: { colorize: true },
      };
    } catch {
      // pino-pretty not available, fall back to JSON output
    }
  }

  return pino(opts);
}

export const logger = createLogger();
