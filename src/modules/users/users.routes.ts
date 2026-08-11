import type { FastifyInstance } from 'fastify';
import type { UsersService } from './users.service.js';
import { createUsersHandler } from './users.handler.js';

export function registerUsersRoutes(app: FastifyInstance, service: UsersService) {
  app.get(
    '/v1/users/me',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Users'],
        security: [{ bearerAuth: [] }],
        response: { 200: { type: 'object' }, 401: { $ref: 'Error#' }, 404: { $ref: 'Error#' } }
      }
    },
    createUsersHandler(service).me
  );
}
