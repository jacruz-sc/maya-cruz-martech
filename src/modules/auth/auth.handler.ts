import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthService } from './service.js';
import { transformAuthUser, transformUser } from './auth.transformer.js';
import { email, parse } from '../../utils/validate.js';
import type { Metrics } from '../../observability/metrics.js';

export const registerInput = z.object({
  email,
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(10).max(72)
});
export const loginInput = z.object({ email, password: z.string().min(1).max(72) });

export function createAuthHandler(app: FastifyInstance, service: AuthService, metrics: Metrics) {
  return {
    register: async (request: FastifyRequest, reply: FastifyReply) => {
      const body = parse(registerInput, request.body);
      const user = await service.register(body);
      metrics.auth.labels('registered').inc();
      return reply.code(201).send(transformUser(user));
    },
    login: async (request: FastifyRequest) => {
      const body = parse(loginInput, request.body);
      try {
        const user = await service.authenticate(body.email, body.password);
        metrics.auth.labels('success').inc();
        return transformAuthUser(user, app.jwt.sign({ sub: user.id, email: user.email }));
      } catch (error) {
        metrics.auth.labels('failure').inc();
        throw error;
      }
    }
  };
}
