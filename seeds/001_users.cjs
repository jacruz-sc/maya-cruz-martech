const bcrypt = require('bcrypt');

exports.seed = async function seed(knex) {
  const passwordHash = await bcrypt.hash('MayaDemo123!', 12);
  await knex('users')
    .insert([
      {
        email: 'alice@example.com',
        display_name: 'Alice Santos',
        password_hash: passwordHash,
        balance_centavos: 10000000
      },
      {
        email: 'bob@example.com',
        display_name: 'Bob Reyes',
        password_hash: passwordHash,
        balance_centavos: 7500000
      },
      {
        email: 'charlie@example.com',
        display_name: 'Charlie Lim',
        password_hash: passwordHash,
        balance_centavos: 5000000
      }
    ])
    .onConflict('email')
    .ignore();
};
