import type { Knex } from 'knex';
import type { TransactionRecord } from '../../types/domain.js';

export interface HistoryQuery {
  userId: string;
  page: number;
  pageSize: number;
  sort: 'asc' | 'desc';
  from: Date | undefined;
  to: Date | undefined;
  direction: 'sent' | 'received' | undefined;
}
export class TransactionsRepository {
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
