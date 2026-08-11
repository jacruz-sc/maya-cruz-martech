import type { Knex } from 'knex';

export class LimitsRepository {
  constructor(private readonly db: Knex) {}
  async sumCompleted(senderId: string, from: Date, to: Date, trx?: Knex | Knex.Transaction) {
    const row = await (trx ?? this.db)('transactions')
      .where({ sender_id: senderId, status: 'completed' })
      .where('created_at', '>=', from)
      .where('created_at', '<', to)
      .sum<{ total: string | null }>({ total: 'amount_centavos' })
      .first();
    return Number(row?.total ?? 0);
  }
}
