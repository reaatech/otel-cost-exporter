import type { Logger } from 'pino';
import pino from 'pino';

export function createLogger(level = 'info', format = 'json'): Logger {
  const opts: pino.LoggerOptions = { level };

  if (format !== 'json') {
    try {
      opts.transport = {
        target: 'pino-pretty',
        options: { colorize: true },
      };
    } catch {}
  }

  return pino(opts);
}

export const logger = createLogger();
