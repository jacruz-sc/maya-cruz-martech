import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export function createMetrics() {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: 'maya_' });
  const requests = new Counter({
    name: 'maya_http_requests_total',
    help: 'HTTP requests by method, route, and status',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [registry]
  });
  const latency = new Histogram({
    name: 'maya_http_request_duration_seconds',
    help: 'HTTP request latency in seconds',
    labelNames: ['method', 'route'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [registry]
  });
  const transfers = new Counter({
    name: 'maya_transfers_total',
    help: 'Transfer attempts by outcome',
    labelNames: ['outcome'] as const,
    registers: [registry]
  });
  const auth = new Counter({
    name: 'maya_authentication_total',
    help: 'Authentication attempts by outcome',
    labelNames: ['outcome'] as const,
    registers: [registry]
  });
  return { registry, requests, latency, transfers, auth };
}

export type Metrics = ReturnType<typeof createMetrics>;
