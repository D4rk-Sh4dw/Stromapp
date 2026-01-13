#!/bin/sh
set -e

echo "🚀 Starting StromApp..."
echo "Using DATABASE_URL from environment..."

# Wait for database and check state using a temporary Node script
cat <<EOF > /tmp/check-db.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  let retries = 30;
  while (retries > 0) {
    try {
      await prisma.$connect();
      console.log('✅ Connected to database');
      
      // Check if User table exists and has entries
      try {
        const count = await prisma.user.count();
        console.log('COUNT:' + count);
        process.exit(0);
      } catch (e) {
        // Table probably doesn't exist
        console.log('EMPTY');
        process.exit(0);
      }
    } catch (e) {
      console.log('Waiting for database... (' + retries + ')');
      await new Promise(r => setTimeout(r, 2000));
      retries--;
    }
  }
  process.exit(1);
}
check();
EOF

OUTPUT=$(node /tmp/check-db.js)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ Could not connect to database."
    exit 1
fi

if echo "$OUTPUT" | grep -q "EMPTY"; then
    echo "📦 Database empty or not initialized. Setting up..."
    DATABASE_URL="$DATABASE_URL" npx prisma db push --accept-data-loss
    DATABASE_URL="$DATABASE_URL" npx prisma db seed
    echo "✅ Database initialized!"
elif echo "$OUTPUT" | grep -q "COUNT:0"; then
    echo "📦 Database tables exist but empty. Seeding..."
    DATABASE_URL="$DATABASE_URL" npx prisma db seed
else
    echo "✅ Database ready!"
fi

# Start the application
exec node server.js
