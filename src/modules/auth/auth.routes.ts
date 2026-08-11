import type { FastifyInstance } from 'fastify';
import type { AuthService } from './service.js';
import { createAuthHandler } from './auth.handler.js';
import type { Metrics } from '../../observability/metrics.js';

const registerBody = {
  type: 'object',
  required: ['email', 'displayName', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    displayName: { type: 'string', minLength: 2, maxLength: 120 },
    password: { type: 'string', minLength: 10, format: 'password' }
  }
};
const loginBody = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', format: 'password' }
  }
};

export function registerAuthRoutes(app: FastifyInstance, service: AuthService, metrics: Metrics) {
  const handler = createAuthHandler(app, service, metrics);
  app.post(
    '/v1/auth/register',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['Auth'],
        body: registerBody,
        response: { 201: { type: 'object' }, 400: { $ref: 'Error#' }, 409: { $ref: 'Error#' } }
      }
    },
    handler.register
  );
  app.post(
    '/v1/auth/login',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      schema: {
        tags: ['Auth'],
        body: loginBody,
        response: { 200: { type: 'object' }, 401: { $ref: 'Error#' } }
      }
    },
    handler.login
  );
}
