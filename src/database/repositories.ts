import type { Knex } from 'knex';
import type { TransactionRecord, UserRecord } from '../types/domain.js';

export class UserRepository {
  constructor(private readonly db: Knex) {}

  findByEmail(email: string, trx: Knex | Knex.Transaction = this.db) {
    return trx<UserRecord>('users').where({ email }).first();
  }

  findById(id: string, trx: Knex | Knex.Transaction = this.db) {
    return trx<UserRecord>('users').where({ id }).first();
  }

  async create(
    data: { email: string; display_name: string; password_hash: string },
    trx: Knex | Knex.Transaction = this.db
  ) {
    const rows = await trx<UserRecord>('users').insert(data).returning('*');
    return rows[0]!;
  }

  lockUsers(ids: string[], trx: Knex.Transaction) {
    return trx<UserRecord>('users').whereIn('id', ids).orderBy('id').forUpdate();
  }

  updateBalance(id: string, balanceCentavos: number, trx: Knex.Transaction) {
    return trx('users')
      .where({ id })
      .update({ balance_centavos: balanceCentavos, updated_at: trx.fn.now() });
  }
}

export interface HistoryQuery {
  userId: string;
  page: number;
  pageSize: number;
  sort: 'asc' | 'desc';
  from: Date | undefined;
  to: Date | undefined;
  direction: 'sent' | 'received' | undefined;
}

export class TransactionRepository {
  constructor(private readonly db: Knex) {}

  findByIdempotency(senderId: string, key: string, trx: Knex.Transaction) {
    return trx<TransactionRecord>('transactions')
      .where({ sender_id: senderId, idempotency_key: key })
      .first();
  }

  async create(data: Omit<TransactionRecord, 'id' | 'created_at'>, trx: Knex.Transaction) {
    const rows = await trx<TransactionRecord>('transactions').insert(data).returning('*');
    return rows[0]!;
  }

  async sumCompleted(senderId: string, from: Date, to: Date, trx: Knex | Knex.Transaction) {
    const row = await trx('transactions')
      .where({ sender_id: senderId, status: 'completed' })
      .where('created_at', '>=', from)
      .where('created_at', '<', to)
      .sum<{ total: string | null }>({ total: 'amount_centavos' })
      .first();
    return Number(row?.total ?? 0);
  }

  async history(query: HistoryQuery) {
    const base = this.db('transactions as t')
      .join('users as s', 's.id', 't.sender_id')
      .join('users as r', 'r.id', 't.recipient_id')
      .where('t.status', 'completed')
      .where((builder) => {
        if (query.direction === 'sent') builder.where('t.sender_id', query.userId);
        else if (query.direction === 'received') builder.where('t.recipient_id', query.userId);
        else builder.where('t.sender_id', query.userId).orWhere('t.recipient_id', query.userId);
      });
    if (query.from) base.where('t.created_at', '>=', query.from);
    if (query.to) base.where('t.created_at', '<', query.to);
    const countRow = await base.clone().count<{ count: string }>({ count: 't.id' }).first();
    const rows = await base
      .clone()
      .select([
        't.id',
        't.amount_centavos',
        't.currency',
        't.created_at',
        't.sender_id',
        't.recipient_id',
        's.email as sender_email',
        's.display_name as sender_name',
        'r.email as recipient_email',
        'r.display_name as recipient_name'
      ])
      .orderBy('t.created_at', query.sort)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return { rows, total: Number(countRow?.count ?? 0) };
  }
}
