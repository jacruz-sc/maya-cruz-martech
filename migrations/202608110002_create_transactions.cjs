exports.up = async function up(knex) {
  await knex.schema.createTable('transactions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('sender_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.uuid('recipient_id').notNullable().references('id').inTable('users').onDelete('RESTRICT');
    table.bigInteger('amount_centavos').notNullable();
    table.string('currency', 3).notNullable().defaultTo('PHP');
    table.string('status', 16).notNullable().defaultTo('completed');
    table.string('idempotency_key', 128).notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check('?? > 0', ['amount_centavos'], 'transactions_amount_positive');
    table.check('?? <> ??', ['sender_id', 'recipient_id'], 'transactions_distinct_users');
    table.check("currency = 'PHP'", [], 'transactions_php_only');
    table.check("status = 'completed'", [], 'transactions_completed_only');
    table.unique(['sender_id', 'idempotency_key']);
    table.index(['sender_id', 'status', 'created_at'], 'transactions_sender_period_idx');
    table.index(['recipient_id', 'created_at'], 'transactions_recipient_history_idx');
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('transactions');
};
