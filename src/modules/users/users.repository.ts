import type { Knex } from 'knex';
import type { UserRecord } from '../../types/domain.js';

export class UsersRepository {
  constructor(private readonly db: Knex) {}
  findById(id: string, trx?: Knex.Transaction) {
    return (trx ?? this.db)<UserRecord>('users').where({ id }).first();
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
