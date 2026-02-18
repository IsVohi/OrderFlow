
#!/bin/bash
set -e

echo "🛑 Stopping existing Inventory Service..."
pkill -f "node dist/main" || true

echo "📦 Rebuilding Inventory Service..."
cd apps/inventory-service
rm -rf dist tsconfig.tsbuildinfo
mkdir -p dist/generated
# Generate Prisma Client FIRST (schema is outside)
npx prisma generate --schema=src/infrastructure/persistence/prisma/schema.prisma
# Compile application
npx tsc
cp -R src/generated/client dist/generated/
# Start
echo "✅ Starting Inventory Service..."
node dist/main > ../../logs/inventory-service.log 2>&1 &
echo "✅ Started (PID: $!)"
