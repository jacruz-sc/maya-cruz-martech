import type { FastifyRequest } from 'fastify';
import type { LimitService } from './service.js';
import { transformLimitUsage } from './limits.transformer.js';

export function createLimitsHandler(service: LimitService) {
  return {
    usage: async (request: FastifyRequest) =>
      transformLimitUsage(await service.usage(request.user.sub))
  };
}
