#!/bin/sh
set -e

echo "🚀 Starting StromApp..."
echo "Using DATABASE_URL: ${DATABASE_URL}"

# The database healthcheck in docker-compose ensures Postgres is ready.
# We run db push and seed every time. 
# - db push: Updates the schema if you updated the app.
# - db seed: Ensures the admin user exists (idempotent via upsert).

echo "📦 Ensuring database schema is up to date..."
npx prisma db push --accept-data-loss

echo "🌱 Running database seed..."
npx prisma db seed

echo "✅ Database is ready!"

# Start the application
exec node server.js
