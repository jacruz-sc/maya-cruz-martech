exports.up = async function up(knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('email', 320).notNullable().unique();
    table.string('display_name', 120).notNullable();
    table.string('password_hash', 100).notNullable();
    table.bigInteger('balance_centavos').notNullable().defaultTo(0);
    table.timestamps(true, true);
    table.check('?? >= 0', ['balance_centavos'], 'users_balance_nonnegative');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('users');
};
