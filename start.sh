#!/bin/sh

echo "🚀 Starting Billing System MongoDB..."

# Quick database check/setup (max 30 seconds)
echo "📦 Database check..."
timeout 30 node scripts/setup-database-mongodb.js 2>&1 || echo "⚡ Continuing to app start..."

# Start application immediately
echo "✅ Starting application on port ${PORT:-8000}..."
exec node app.js
