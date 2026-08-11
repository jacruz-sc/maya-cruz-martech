import type { Knex } from 'knex';
export class SystemRepository {
  constructor(private readonly db: Knex) {}
  async checkDatabase() {
    await this.db.raw('select 1');
  }
}
