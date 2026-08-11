import '@fastify/jwt';
import type { Knex } from 'knex';
import type { AppConfig } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Knex;
    config: AppConfig;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}
