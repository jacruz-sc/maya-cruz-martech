#!/bin/sh
set -eu
echo "Running database migrations"
npx knex --knexfile knexfile.cjs migrate:latest
echo "Applying idempotent seed data"
npx knex --knexfile knexfile.cjs seed:run
exec node dist/server.js
