import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { Knex } from 'knex';
import { randomUUID } from 'node:crypto';
import { loadConfig, type AppConfig } from './config/env.js';
import { createDatabase } from './database/client.js';
import { createMetrics, type Metrics } from './observability/metrics.js';
import { AppError } from './utils/app-error.js';
import { transformError } from './http/error.transformer.js';
import { AuthRepository } from './modules/auth/auth.repository.js';
import { AuthService } from './modules/auth/service.js';
import { registerAuthRoutes } from './modules/auth/auth.routes.js';
import { UsersRepository } from './modules/users/users.repository.js';
import { UsersService } from './modules/users/users.service.js';
import { registerUsersRoutes } from './modules/users/users.routes.js';
import { LimitsRepository } from './modules/limits/limits.repository.js';
import { LimitService } from './modules/limits/service.js';
import { registerLimitsRoutes } from './modules/limits/limits.routes.js';
import { TransactionsRepository } from './modules/transactions/transactions.repository.js';
import { TransactionService } from './modules/transactions/service.js';
import { registerTransactionsRoutes } from './modules/transactions/transactions.routes.js';
import { SystemRepository } from './modules/system/system.repository.js';
import { SystemService } from './modules/system/system.service.js';
import { registerSystemRoutes } from './modules/system/system.routes.js';

const errorSchema = {
  type: 'object',
  properties: {
    error: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        requestId: { type: 'string' },
        details: { type: 'object' }
      }
    }
  }
} as const;
export interface AppOptions {
  config?: AppConfig;
  db?: Knex;
  metrics?: Metrics;
  logger?: boolean;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const db = options.db ?? createDatabase(config);
  const metrics = options.metrics ?? createMetrics();
  const app = Fastify({
    logger: options.logger ?? true,
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
    disableRequestLogging: true
  });
  app.addSchema({ $id: 'Error', ...errorSchema });
  app.decorate('db', db);
  app.decorate('config', config);
  app.decorate('authenticate', async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
    }
  });
  await app.register(cors, { origin: config.CORS_ORIGIN === '*' ? true : config.CORS_ORIGIN });
  await app.register(helmet);
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW
  });
  await app.register(jwt, {
    secret: config.JWT_SECRET,
    sign: { expiresIn: config.JWT_EXPIRES_IN }
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Maya Send Money API',
        version: '1.0.0',
        description: 'Internal PHP transfers with Asia/Manila spending limits'
      },
      servers: [{ url: 'http://localhost:3000' }],
      tags: [
        { name: 'Auth' },
        { name: 'Users' },
        { name: 'Transfers' },
        { name: 'Limits' },
        { name: 'System' }
      ],
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
        schemas: { Error: errorSchema }
      }
    }
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });
  app.addHook('onRequest', async (request) => {
    (request as FastifyRequest & { metricsStart?: bigint }).metricsStart = process.hrtime.bigint();
    await Promise.resolve();
  });
  app.addHook('onResponse', async (request, reply) => {
    const start = (request as FastifyRequest & { metricsStart?: bigint }).metricsStart;
    const route = request.routeOptions.url ?? 'unknown';
    if (start)
      metrics.latency
        .labels(request.method, route)
        .observe(Number(process.hrtime.bigint() - start) / 1e9);
    metrics.requests.labels(request.method, route, String(reply.statusCode)).inc();
    await Promise.resolve();
  });

  const authRepository = new AuthRepository(db);
  const usersRepository = new UsersRepository(db);
  const transactionsRepository = new TransactionsRepository(db);
  const limitsService = new LimitService(new LimitsRepository(db), db);
  registerSystemRoutes(app, new SystemService(new SystemRepository(db)), metrics);
  registerAuthRoutes(app, new AuthService(authRepository), metrics);
  registerUsersRoutes(app, new UsersService(usersRepository));
  registerLimitsRoutes(app, limitsService);
  registerTransactionsRoutes(
    app,
    new TransactionService(db, usersRepository, transactionsRepository, limitsService),
    metrics
  );
  app.setErrorHandler((error, request, reply) => {
    const transformed = transformError(error, request);
    if (transformed.statusCode >= 500)
      request.log.error({ err: error, requestId: request.id }, 'request failed');
    return reply.code(transformed.statusCode).send(transformed.body);
  });
  return app;
}
