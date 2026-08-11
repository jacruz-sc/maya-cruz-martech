import type { FastifyInstance } from 'fastify';
import type { Metrics } from '../../observability/metrics.js';
import type { SystemService } from './system.service.js';
import { createSystemHandler } from './system.handler.js';

export function registerSystemRoutes(
  app: FastifyInstance,
  service: SystemService,
  metrics: Metrics
) {
  const handler = createSystemHandler(service, metrics);
  app.get(
    '/health/live',
    {
      schema: {
        tags: ['System'],
        response: { 200: { type: 'object', properties: { status: { type: 'string' } } } }
      }
    },
    handler.live
  );
  app.get(
    '/health/ready',
    {
      schema: {
        tags: ['System'],
        response: {
          200: {
            type: 'object',
            properties: { status: { type: 'string' }, database: { type: 'string' } }
          },
          503: { $ref: 'Error#' }
        }
      }
    },
    handler.ready
  );
  app.get('/metrics', { schema: { hide: true } }, handler.metrics);
}
