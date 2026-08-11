import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { Knex } from 'knex';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { loadConfig, type AppConfig } from './config/env.js';
import { createDatabase } from './database/client.js';
import { AuthService } from './modules/auth/service.js';
import { LimitService } from './modules/limits/service.js';
import { TransactionService } from './modules/transactions/service.js';
import { UserRepository } from './database/repositories.js';
import { AppError } from './utils/app-error.js';
import { parse, email, uuid } from './utils/validate.js';
import { formatCentavos } from './utils/money.js';
import { createMetrics, type Metrics } from './observability/metrics.js';

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
const transferBody = {
  type: 'object',
  required: ['recipientId', 'amount'],
  properties: {
    recipientId: { type: 'string', format: 'uuid' },
    amount: { type: 'string', pattern: '^(?:0|[1-9]\\d*)(?:\\.\\d{1,2})?$' }
  }
};
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
      tags: [{ name: 'Auth' }, { name: 'Transfers' }, { name: 'Limits' }, { name: 'System' }],
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

  const auth = new AuthService(db);
  const users = new UserRepository(db);
  const limits = new LimitService(db);
  const transfers = new TransactionService(db);

  app.get(
    '/health/live',
    {
      schema: {
        tags: ['System'],
        response: { 200: { type: 'object', properties: { status: { type: 'string' } } } }
      }
    },
    () => ({ status: 'ok' })
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
    async (_request, reply) => {
      try {
        await db.raw('select 1');
        return { status: 'ok', database: 'ok' };
      } catch {
        return reply
          .code(503)
          .send({ error: { code: 'NOT_READY', message: 'Database is unavailable' } });
      }
    }
  );
  app.get('/metrics', { schema: { hide: true } }, (_request, reply) => {
    reply.header('content-type', metrics.registry.contentType);
    return metrics.registry.metrics();
  });

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
    async (request, reply) => {
      const body = parse(registerSchema, request.body);
      const user = await auth.register(body);
      metrics.auth.labels('registered').inc();
      return reply.code(201).send(publicUser(user));
    }
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
    async (request) => {
      const body = parse(loginSchema, request.body);
      try {
        const user = await auth.authenticate(body.email, body.password);
        metrics.auth.labels('success').inc();
        return { token: app.jwt.sign({ sub: user.id, email: user.email }), user: publicUser(user) };
      } catch (error) {
        metrics.auth.labels('failure').inc();
        throw error;
      }
    }
  );
  app.get(
    '/v1/users/me',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        response: { 200: { type: 'object' }, 401: { $ref: 'Error#' } }
      }
    },
    async (request) => {
      const user = await users.findById(request.user.sub);
      if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User does not exist');
      return publicUser(user);
    }
  );
  app.post(
    '/v1/transfers',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Transfers'],
        security: [{ bearerAuth: [] }],
        headers: {
          type: 'object',
          required: ['idempotency-key'],
          properties: { 'idempotency-key': { type: 'string', minLength: 8, maxLength: 128 } }
        },
        body: transferBody,
        response: {
          201: { type: 'object' },
          400: { $ref: 'Error#' },
          401: { $ref: 'Error#' },
          404: { $ref: 'Error#' },
          422: { $ref: 'Error#' }
        }
      }
    },
    async (request, reply) => {
      const body = parse(transferSchema, request.body);
      const key = request.headers['idempotency-key'];
      if (typeof key !== 'string')
        throw new AppError(400, 'VALIDATION_ERROR', 'Idempotency-Key header is required');
      try {
        const transaction = await transfers.transfer({
          senderId: request.user.sub,
          recipientId: body.recipientId,
          amount: body.amount,
          idempotencyKey: key
        });
        metrics.transfers.labels('completed').inc();
        return reply.code(201).send(publicTransaction(transaction));
      } catch (error) {
        metrics.transfers
          .labels(error instanceof AppError ? error.code.toLowerCase() : 'error')
          .inc();
        throw error;
      }
    }
  );
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
    async (request) => {
      const usage = await limits.usage(request.user.sub);
      return {
        currency: 'PHP',
        timezone: 'Asia/Manila',
        daily: {
          limit: '50000.00',
          used: formatCentavos(usage.dailyUsedCentavos),
          remaining: formatCentavos(usage.dailyRemainingCentavos),
          startsAt: usage.dayStart.toISOString()
        },
        monthly: {
          limit: '500000.00',
          used: formatCentavos(usage.monthlyUsedCentavos),
          remaining: formatCentavos(usage.monthlyRemainingCentavos),
          startsAt: usage.monthStart.toISOString()
        }
      };
    }
  );
  app.get(
    '/v1/transfers',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Transfers'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sort: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
            direction: { type: 'string', enum: ['sent', 'received'] },
            from: { type: 'string', format: 'date-time' },
            to: { type: 'string', format: 'date-time' }
          }
        },
        response: { 200: { type: 'object' } }
      }
    },
    async (request) => {
      const parsed = parse(historySchema, request.query);
      const page = parsed.page ?? 1;
      const pageSize = parsed.pageSize ?? 20;
      const sort = parsed.sort ?? 'desc';
      const result = await transfers.history({
        userId: request.user.sub,
        page,
        pageSize,
        sort,
        direction: parsed.direction,
        from: parsed.from ? new Date(parsed.from) : undefined,
        to: parsed.to ? new Date(parsed.to) : undefined
      });
      return {
        data: result.rows.map(publicHistoryRow),
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / pageSize)
        }
      };
    }
  );

  app.setErrorHandler((error, request, reply) => {
    const appError =
      error instanceof AppError
        ? error
        : new AppError(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
    if (appError.statusCode >= 500)
      request.log.error({ err: error, requestId: request.id }, 'request failed');
    return reply.code(appError.statusCode).send({
      error: {
        code: appError.code,
        message: appError.message,
        requestId: request.id,
        ...(appError.details ? { details: appError.details } : {})
      }
    });
  });
  return app;
}

const registerSchema = z.object({
  email,
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(10).max(72)
});
const loginSchema = z.object({ email, password: z.string().min(1).max(72) });
const transferSchema = z.object({ recipientId: uuid, amount: z.string() });
const historySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc'),
  direction: z.enum(['sent', 'received']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

function publicUser(user: {
  id: string;
  email: string;
  display_name: string;
  balance_centavos: number | string;
}) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    balance: formatCentavos(user.balance_centavos),
    currency: 'PHP'
  };
}
function publicTransaction(transaction: {
  id: string;
  sender_id: string;
  recipient_id: string;
  amount_centavos: number | string;
  currency: string;
  status: string;
  created_at: Date;
}) {
  return {
    id: transaction.id,
    senderId: transaction.sender_id,
    recipientId: transaction.recipient_id,
    amount: formatCentavos(transaction.amount_centavos),
    currency: transaction.currency,
    status: transaction.status,
    createdAt: new Date(transaction.created_at).toISOString()
  };
}
function publicHistoryRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    amount: formatCentavos(row.amount_centavos as string),
    currency: row.currency,
    sender: { id: row.sender_id, email: row.sender_email, displayName: row.sender_name },
    recipient: {
      id: row.recipient_id,
      email: row.recipient_email,
      displayName: row.recipient_name
    },
    createdAt: new Date(row.created_at as Date).toISOString()
  };
}
