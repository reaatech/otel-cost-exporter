import http from 'node:http';
import { createHealthServer } from '@reaatech/otel-cost-exporter';
import { describe, expect, it } from 'vitest';

function httpGet(port: number, path: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    http
      .get(`http://localhost:${port}${path}`, (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: data });
          }
        });
      })
      .on('error', reject);
  });
}

function httpRequest(
  port: number,
  path: string,
  method: string,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port,
        path,
        method,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: data });
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function startAndGet(port: number, path: string): Promise<{ status: number; body: unknown }> {
  const server = createHealthServer();
  await server.start(port);
  try {
    return await httpGet(port, path);
  } finally {
    await server.shutdown();
  }
}

describe('createHealthServer', () => {
  describe('GET /health', () => {
    it('should return 200 with healthy status', async () => {
      const response = await startAndGet(18881, '/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'healthy' });
    });
  });

  describe('GET /ready', () => {
    it('should return 200 with ready status', async () => {
      const response = await startAndGet(18882, '/ready');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ready' });
    });
  });

  describe('unknown endpoints', () => {
    it('should return 404 for unknown paths', async () => {
      const response = await startAndGet(18883, '/unknown');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Not found' });
    });
  });

  describe('non-GET methods', () => {
    it('should return 405 for POST requests', async () => {
      const port = 18884;
      const server = createHealthServer();
      await server.start(port);
      try {
        const result = await httpRequest(port, '/health', 'POST');
        expect(result.status).toBe(405);
        expect(result.body).toEqual({ error: 'Method not allowed' });
      } finally {
        await server.shutdown();
      }
    });
  });

  describe('lifecycle', () => {
    it('should start and shut down cleanly', async () => {
      const server = createHealthServer();
      await server.start(18885);
      const response = await httpGet(18885, '/health');
      expect(response.status).toBe(200);
      await server.shutdown();
    });

    it('should not throw on multiple shutdown calls', async () => {
      const server = createHealthServer();
      await server.start(18886);
      await server.shutdown();
      await expect(server.shutdown()).resolves.toBeUndefined();
      await expect(server.shutdown()).resolves.toBeUndefined();
    });

    it('should reject starting an already-running server', async () => {
      const server = createHealthServer();
      await server.start(18887);
      try {
        await expect(server.start(18887)).rejects.toThrow('Health server is already running');
      } finally {
        await server.shutdown();
      }
    });
  });

  describe('debug endpoints', () => {
    it('should return debug info', async () => {
      const server = createHealthServer();
      await server.start(18888);
      server.updateDebugInfo({
        uptime: 0,
        spansProcessed: 42,
        spansDropped: 0,
        modelCount: 37,
        pricingTableVersion: '2026.04',
      });

      try {
        const { status, body } = await httpGet(18888, '/debug');
        expect(status).toBe(200);
        const data = body as Record<string, unknown>;
        expect(data.spansProcessed).toBe(42);
        expect(data.modelCount).toBe(37);
      } finally {
        await server.shutdown();
      }
    });

    it('should return pricing debug info', async () => {
      const server = createHealthServer();
      await server.start(18889);
      server.updateDebugInfo({
        uptime: 0,
        spansProcessed: 0,
        spansDropped: 0,
        pricingTableVersion: '2026.04',
        pricingLastUpdated: '2026-04-01T00:00:00Z',
        modelCount: 37,
      });

      try {
        const { status, body } = await httpGet(18889, '/debug/pricing');
        expect(status).toBe(200);
        const data = body as Record<string, unknown>;
        expect(data.version).toBe('2026.04');
        expect(data.modelCount).toBe(37);
      } finally {
        await server.shutdown();
      }
    });

    it('should return cache debug info', async () => {
      const server = createHealthServer();
      await server.start(18890);
      server.updateDebugInfo({
        uptime: 0,
        spansProcessed: 0,
        spansDropped: 0,
        cacheStats: { hits: 100, misses: 20, size: 50, maxSize: 1000, hitRate: 0.83 },
      });

      try {
        const { status, body } = await httpGet(18890, '/debug/cache');
        expect(status).toBe(200);
        const data = body as Record<string, unknown>;
        expect(data.hits).toBe(100);
        expect(data.misses).toBe(20);
      } finally {
        await server.shutdown();
      }
    });
  });
});
