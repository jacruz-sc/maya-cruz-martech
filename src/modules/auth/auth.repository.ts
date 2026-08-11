import type { Knex } from 'knex';
import type { UserRecord } from '../../types/domain.js';

export class AuthRepository {
  constructor(private readonly db: Knex) {}
  findByEmail(email: string, trx?: Knex.Transaction) {
    return (trx ?? this.db)<UserRecord>('users').where({ email }).first();
  }
  async create(
    data: { email: string; display_name: string; password_hash: string },
    trx?: Knex.Transaction
  ) {
    const rows = await (trx ?? this.db)<UserRecord>('users').insert(data).returning('*');
    return rows[0]!;
  }
}
