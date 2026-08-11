import type { Knex } from 'knex';
import { AppError } from '../../utils/app-error.js';
import { parseAmountToCentavos } from '../../utils/money.js';
import type { UsersRepository } from '../users/users.repository.js';
import type { TransactionsRepository, HistoryQuery } from './transactions.repository.js';
import type { LimitService } from '../limits/service.js';

export class TransactionService {
  private readonly users: UsersRepository;
  private readonly transactions: TransactionsRepository;
  private readonly limits: LimitService;
  constructor(
    private readonly db: Knex,
    users: UsersRepository,
    transactions: TransactionsRepository,
    limits: LimitService
  ) {
    this.users = users;
    this.transactions = transactions;
    this.limits = limits;
  }

  async transfer(input: {
    senderId: string;
    recipientId: string;
    amount: string;
    idempotencyKey: string;
  }) {
    const amountCentavos = parseAmountToCentavos(input.amount);
    return this.db.transaction(async (trx) => {
      const existing = await this.transactions.findByIdempotency(
        input.senderId,
        input.idempotencyKey,
        trx
      );
      if (existing) {
        if (
          existing.recipient_id !== input.recipientId ||
          Number(existing.amount_centavos) !== amountCentavos
        )
          throw new AppError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key was already used for another transfer'
          );
        return existing;
      }
      const recipient = await this.users.findById(input.recipientId, trx);
      if (!recipient) throw new AppError(404, 'RECIPIENT_NOT_FOUND', 'Recipient does not exist');
      if (input.senderId === input.recipientId)
        throw new AppError(400, 'SELF_TRANSFER', 'Sender and recipient must be different');
      const locked = await this.users.lockUsers([input.senderId, input.recipientId], trx);
      const sender = locked.find((user) => user.id === input.senderId);
      if (!sender) throw new AppError(404, 'USER_NOT_FOUND', 'Sender does not exist');
      const lockedExisting = await this.transactions.findByIdempotency(
        input.senderId,
        input.idempotencyKey,
        trx
      );
      if (lockedExisting) {
        if (
          lockedExisting.recipient_id !== input.recipientId ||
          Number(lockedExisting.amount_centavos) !== amountCentavos
        )
          throw new AppError(
            409,
            'IDEMPOTENCY_CONFLICT',
            'Idempotency key was already used for another transfer'
          );
        return lockedExisting;
      }
      const balance = Number(sender.balance_centavos);
      if (balance < amountCentavos)
        throw new AppError(422, 'INSUFFICIENT_BALANCE', 'Insufficient balance');
      try {
        await this.limits.assertCanSpend(input.senderId, amountCentavos, trx);
      } catch (error) {
        if (error instanceof Error && error.message === 'DAILY_LIMIT_EXCEEDED')
          throw new AppError(422, 'DAILY_LIMIT_EXCEEDED', 'Daily spending limit exceeded');
        if (error instanceof Error && error.message === 'MONTHLY_LIMIT_EXCEEDED')
          throw new AppError(422, 'MONTHLY_LIMIT_EXCEEDED', 'Monthly spending limit exceeded');
        throw error;
      }
      await this.users.updateBalance(input.senderId, balance - amountCentavos, trx);
      const recipientRow = locked.find((user) => user.id === input.recipientId)!;
      await this.users.updateBalance(
        input.recipientId,
        Number(recipientRow.balance_centavos) + amountCentavos,
        trx
      );
      return this.transactions.create(
        {
          sender_id: input.senderId,
          recipient_id: input.recipientId,
          amount_centavos: amountCentavos,
          currency: 'PHP',
          status: 'completed',
          idempotency_key: input.idempotencyKey
        },
        trx
      );
    });
  }

  history(query: HistoryQuery) {
    return this.transactions.history(query);
  }
}
