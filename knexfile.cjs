const connection =
  process.env.DATABASE_URL || 'postgresql://maya:maya@localhost:5432/maya_send_money';
const shared = {
  client: 'pg',
  connection,
  migrations: { directory: './migrations', extension: 'cjs' },
  seeds: { directory: './seeds', extension: 'cjs' }
};
module.exports = {
  development: shared,
  test: { ...shared, pool: { min: 0, max: 5 } },
  production: { ...shared, pool: { min: 2, max: 20 } }
};
