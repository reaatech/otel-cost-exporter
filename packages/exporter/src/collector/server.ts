import http from 'node:http';

export interface DebugInfo {
  pricingTableVersion?: string;
  pricingLastUpdated?: string;
  modelCount?: number;
  cacheStats?: { hits: number; misses: number; size: number; maxSize: number; hitRate: number };
  uptime: number;
  spansProcessed: number;
  spansDropped: number;
}

export interface HealthServer {
  start(port?: number): Promise<void>;
  shutdown(): Promise<void>;
  updateDebugInfo(info: DebugInfo): void;
}

const DEFAULT_PORT = 8889;

export function createHealthServer(): HealthServer {
  let server: http.Server | null = null;
  const startTime = Date.now();
  let debugInfo: DebugInfo = { uptime: 0, spansProcessed: 0, spansDropped: 0 };

  function getUptime(): number {
    return Date.now() - startTime;
  }

  const requestListener: http.RequestListener = (_req, res) => {
    const url = _req.url ?? '/';
    const method = _req.method ?? 'GET';

    if (method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy' }));
      return;
    }

    if (url === '/ready') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ready' }));
      return;
    }

    if (url === '/debug') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ...debugInfo, uptime: getUptime() }));
      return;
    }

    if (url === '/debug/pricing') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          version: debugInfo.pricingTableVersion,
          lastUpdated: debugInfo.pricingLastUpdated,
          modelCount: debugInfo.modelCount,
        }),
      );
      return;
    }

    if (url === '/debug/cache') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(debugInfo.cacheStats ?? {}));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  };

  return {
    start(port: number = DEFAULT_PORT): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        if (server) {
          reject(new Error('Health server is already running'));
          return;
        }

        server = http.createServer(requestListener);

        server.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'EADDRINUSE') {
            reject(new Error(`Port ${port} is already in use`));
          } else {
            reject(err);
          }
        });

        server.listen(port, () => {
          resolve();
        });
      });
    },

    shutdown(): Promise<void> {
      return new Promise<void>((resolve) => {
        if (!server) {
          resolve();
          return;
        }

        const s = server;
        server = null;
        s.close(() => {
          resolve();
        });
      });
    },

    updateDebugInfo(info: DebugInfo): void {
      debugInfo = info;
    },
  };
}
