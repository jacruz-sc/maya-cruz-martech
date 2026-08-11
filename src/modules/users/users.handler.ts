import type { FastifyRequest } from 'fastify';
import type { UsersService } from './users.service.js';
import { transformUser } from './users.transformer.js';

export function createUsersHandler(service: UsersService) {
  return {
    me: async (request: FastifyRequest) =>
      transformUser(await service.getCurrentUser(request.user.sub))
  };
}
