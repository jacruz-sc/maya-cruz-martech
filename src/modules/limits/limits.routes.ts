import type { FastifyInstance } from 'fastify';
import type { LimitService } from './service.js';
import { createLimitsHandler } from './limits.handler.js';

export function registerLimitsRoutes(app: FastifyInstance, service: LimitService) {
  app.get(
    '/v1/limits/usage',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Limits'],
        security: [{ bearerAuth: [] }],
        response: { 200: { type: 'object' }, 401: { $ref: 'Error#' } }
      }
    },
    createLimitsHandler(service).usage
  );
}
