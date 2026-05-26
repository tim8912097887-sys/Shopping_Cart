#!/bin/sh
set -e

echo "Starting entrypoint script..."

# 1. Network check
echo "Checking network connectivity to product_service_db:5432..."
MAX_RETRIES=30
COUNT=0

until nc -z product_service_db 5432 || [ $COUNT -eq $MAX_RETRIES ]; do
  echo "Database port not responding yet... (Attempt $COUNT/$MAX_RETRIES)"
  COUNT=$((COUNT + 1))
  sleep 2
done

if [ $COUNT -eq $MAX_RETRIES ]; then
  echo "Error: Database port timed out."
  exit 1
fi

# 2. Deploy Migrations
echo "Database port open. Running migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

# 3. Start App
echo "Migrations complete. Launching application..."
exec node dist/main.js