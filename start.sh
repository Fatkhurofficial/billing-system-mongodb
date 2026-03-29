#!/bin/sh

echo "🚀 Starting Billing System MongoDB..."

# Wait for potential database connection
echo "⏳ Waiting 5 seconds for connections..."
sleep 5

# Setup database (create collections if not exist)
echo "📦 Setting up MongoDB collections..."
node scripts/setup-database-mongodb.js || echo "⚠️  Database already initialized or error occurred"

# Start application
echo "✅ Starting application on port 4555..."
exec node app.js
