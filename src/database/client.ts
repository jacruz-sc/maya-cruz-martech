import knex, { type Knex } from 'knex';
import type { AppConfig } from '../config/env.js';

export function createDatabase(config: AppConfig): Knex {
  return knex({
    client: 'pg',
    connection: config.DATABASE_URL,
    pool: { min: config.DB_POOL_MIN, max: config.DB_POOL_MAX },
    acquireConnectionTimeout: 10_000
  });
}
