import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { parse, uuid } from '../../utils/validate.js';
import type { Metrics } from '../../observability/metrics.js';
import { AppError } from '../../utils/app-error.js';
import type { TransactionService } from './service.js';
import { transformHistoryRow, transformTransaction } from './transactions.transformer.js';

export const transferInput = z.object({ recipientId: uuid, amount: z.string() });
export const historyInput = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['asc', 'desc']).default('desc'),
  direction: z.enum(['sent', 'received']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

export function createTransactionsHandler(service: TransactionService, metrics: Metrics) {
  return {
    transfer: async (request: FastifyRequest, reply: FastifyReply) => {
      const body = parse(transferInput, request.body);
      const key = request.headers['idempotency-key'];
      if (typeof key !== 'string')
        throw new AppError(400, 'VALIDATION_ERROR', 'Idempotency-Key header is required');
      try {
        const result = await service.transfer({
          senderId: request.user.sub,
          recipientId: body.recipientId,
          amount: body.amount,
          idempotencyKey: key
        });
        metrics.transfers.labels('completed').inc();
        return reply.code(201).send(transformTransaction(result));
      } catch (error) {
        metrics.transfers
          .labels(error instanceof AppError ? error.code.toLowerCase() : 'error')
          .inc();
        throw error;
      }
    },
    history: async (request: FastifyRequest) => {
      const query = parse(historyInput, request.query);
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 20;
      const result = await service.history({
        userId: request.user.sub,
        page,
        pageSize,
        sort: query.sort ?? 'desc',
        direction: query.direction,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined
      });
      return {
        data: result.rows.map(transformHistoryRow),
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / pageSize)
        }
      };
    }
  };
}
