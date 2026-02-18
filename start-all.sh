#!/bin/bash

# OrderFlow - Start All Services Script
# This script starts all microservices in the background

set -e

echo "🚀 Starting OrderFlow..."
echo ""

# Check if Docker is running
echo "📦 Starting infrastructure (PostgreSQL, Kafka, etc.)..."
npm run docker:up
echo "✅ Infrastructure started"
echo ""
echo "⏳ Waiting for services to be healthy (30 seconds)..."
sleep 30
echo "✅ Services should be healthy"
echo ""

# Build shared packages first using pnpm
echo "📚 Building shared packages..."
pnpm --filter "./packages/*" build

# Start Order Service in background
echo "🛒 Starting Order Service (port 3001)..."
cd apps/order-service
rm -rf dist tsconfig.tsbuildinfo
mkdir -p dist/infrastructure/persistence
# Generate Prisma Client FIRST so TSC has types
npx prisma generate --schema=src/infrastructure/persistence/prisma/schema.prisma
# Compile application
# Compile application (Skipped due to build issues, using ts-node)
# npx tsc
echo "📝 Debug: Listing dist folder for Order Service (Skipped)"
# ls -R dist
# Copy generated client to dist for runtime (Not needed for ts-node)
# cp -R src/infrastructure/persistence/client dist/infrastructure/persistence/
# node dist/main > ../../logs/order-service.log 2>&1 &
npx ts-node -r tsconfig-paths/register src/main.ts > ../../logs/order-service.log 2>&1 &
ORDER_PID=$!
echo "✅ Order Service started (PID: $ORDER_PID)"
cd ../..

# Start Inventory Service in background
echo "📦 Starting Inventory Service (port 3002)..."
cd apps/inventory-service
rm -rf dist tsconfig.tsbuildinfo
mkdir -p dist/generated
# Generate Prisma Client FIRST
npx prisma generate --schema=src/infrastructure/persistence/prisma/schema.prisma
# Compile application
npx tsc
cp -R src/generated/client dist/generated/
node dist/main > ../../logs/inventory-service.log 2>&1 &
INVENTORY_PID=$!
echo "✅ Inventory Service started (PID: $INVENTORY_PID)"
cd ../..

# Start Payment Service in background
echo "💳 Starting Payment Service (port 3003)..."
cd apps/payment-service
rm -rf dist tsconfig.tsbuildinfo
mkdir -p dist/infrastructure/persistence
# Generate Prisma Client FIRST
npx prisma generate --schema=src/infrastructure/persistence/prisma/schema.prisma
# Compile application
npx tsc
cp -R src/infrastructure/persistence/client dist/infrastructure/persistence/
node dist/main > ../../logs/payment-service.log 2>&1 &
PAYMENT_PID=$!
echo "✅ Payment Service started (PID: $PAYMENT_PID)"
cd ../..

# Start Dashboard in background
echo "🖥️ Starting Dashboard (port 3000)..."
cd apps/dashboard
npm run dev > ../../logs/dashboard.log 2>&1 &
DASHBOARD_PID=$!
echo "✅ Dashboard started (PID: $DASHBOARD_PID)"
cd ../..

# Save PIDs to file for stopping later
mkdir -p .pids
echo $ORDER_PID > .pids/order.pid
echo $INVENTORY_PID > .pids/inventory.pid
echo $INVENTORY_PID > .pids/inventory.pid
echo $PAYMENT_PID > .pids/payment.pid
echo $DASHBOARD_PID > .pids/dashboard.pid

echo ""
echo "✅ All services started!"
echo ""
echo "📊 Available UIs:"
echo "  - Dashboard:    http://localhost:3000"
echo "  - Kafka UI:     http://localhost:8080"
echo "  - Grafana:      http://localhost:3004 (admin/admin)"
echo "  - Prometheus:   http://localhost:9090"
echo "  - Jaeger:       http://localhost:16686"
echo ""
echo "🔗 API Endpoints:"
echo "  - Order API:     http://localhost:3001"
echo "  - Inventory API: http://localhost:3002"
echo "  - Payment API:   http://localhost:3003"
echo ""
echo "📝 Logs:"
echo "  - tail -f logs/order-service.log"
echo "  - tail -f logs/inventory-service.log"
echo "  - tail -f logs/payment-service.log"
echo "  - tail -f logs/dashboard.log"
echo ""
echo "🛑 To stop all services, run: ./stop-all.sh"
echo ""
