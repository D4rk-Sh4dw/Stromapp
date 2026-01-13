#!/bin/sh
set -e

echo "🚀 Starting StromApp..."

# Check if database has tables
DB_PATH="./prisma/dev.db"
HAS_TABLES=0

if [ -f "$DB_PATH" ]; then
    # Check if User table exists
    if sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='User';" 2>/dev/null | grep -q "User"; then
        HAS_TABLES=1
    fi
fi

if [ $HAS_TABLES -eq 0 ]; then
    echo "📦 Database empty or not initialized. Setting up..."
    npx prisma db push --skip-generate
    npx prisma db seed
    echo "✅ Database initialized!"
else
    echo "✅ Database ready!"
fi

# Start the application
exec node server.js
