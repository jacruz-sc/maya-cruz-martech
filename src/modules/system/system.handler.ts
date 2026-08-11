import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Metrics } from '../../observability/metrics.js';
import { transformLive, transformReady } from './system.transformer.js';
import type { SystemService } from './system.service.js';
export function createSystemHandler(service: SystemService, metrics: Metrics) {
  return {
    live: () => transformLive(),
    ready: async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        await service.ready();
        return transformReady();
      } catch {
        return reply
          .code(503)
          .send({ error: { code: 'NOT_READY', message: 'Database is unavailable' } });
      }
    },
    metrics: (_request: FastifyRequest, reply: FastifyReply) => {
      reply.header('content-type', metrics.registry.contentType);
      return metrics.registry.metrics();
    }
  };
}
