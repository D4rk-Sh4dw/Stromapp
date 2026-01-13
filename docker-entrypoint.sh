#!/bin/sh
set -e

echo "🚀 Starting StromApp..."

# Check if database exists and has tables
if [ ! -f "./prisma/dev.db" ] || ! sqlite3 ./prisma/dev.db "SELECT name FROM sqlite_master WHERE type='table' LIMIT 1;" > /dev/null 2>&1; then
    echo "📦 Database not found or empty. Initializing..."
    npx prisma db push --skip-generate
    npx prisma db seed
    echo "✅ Database initialized!"
else
    echo "✅ Database found!"
fi

# Start the application
exec node server.js
