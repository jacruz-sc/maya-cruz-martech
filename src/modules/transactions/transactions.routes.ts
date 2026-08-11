import type { FastifyInstance } from 'fastify';
import type { Metrics } from '../../observability/metrics.js';
import type { TransactionService } from './service.js';
import { createTransactionsHandler } from './transactions.handler.js';

const transferBody = {
  type: 'object',
  required: ['recipientId', 'amount'],
  properties: {
    recipientId: { type: 'string', format: 'uuid' },
    amount: { type: 'string', pattern: '^(?:0|[1-9]\\d*)(?:\\.\\d{1,2})?$' }
  }
};
const historyQuery = {
  type: 'object',
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    sort: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    direction: { type: 'string', enum: ['sent', 'received'] },
    from: { type: 'string', format: 'date-time' },
    to: { type: 'string', format: 'date-time' }
  }
};

export function registerTransactionsRoutes(
  app: FastifyInstance,
  service: TransactionService,
  metrics: Metrics
) {
  const handler = createTransactionsHandler(service, metrics);
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
    handler.transfer
  );
  app.get(
    '/v1/transfers',
    {
      preHandler: app.authenticate,
      schema: {
        tags: ['Transfers'],
        security: [{ bearerAuth: [] }],
        querystring: historyQuery,
        response: { 200: { type: 'object' } }
      }
    },
    handler.history
  );
}
