#!/bin/bash

# OrderFlow - Stop All Services Script

echo "🛑 Stopping OrderFlow services..."
echo ""

# Stop services using saved PIDs
if [ -d ".pids" ]; then
    if [ -f ".pids/order.pid" ]; then
        ORDER_PID=$(cat .pids/order.pid)
        echo "Stopping Order Service (PID: $ORDER_PID)..."
        kill $ORDER_PID 2>/dev/null || echo "  Already stopped"
    fi
    
    if [ -f ".pids/inventory.pid" ]; then
        INVENTORY_PID=$(cat .pids/inventory.pid)
        echo "Stopping Inventory Service (PID: $INVENTORY_PID)..."
        kill $INVENTORY_PID 2>/dev/null || echo "  Already stopped"
    fi
    
    if [ -f ".pids/payment.pid" ]; then
        PAYMENT_PID=$(cat .pids/payment.pid)
        echo "Stopping Payment Service (PID: $PAYMENT_PID)..."
        kill $PAYMENT_PID 2>/dev/null || echo "  Already stopped"
    fi

    if [ -f ".pids/dashboard.pid" ]; then
        DASHBOARD_PID=$(cat .pids/dashboard.pid)
        echo "Stopping Dashboard (PID: $DASHBOARD_PID)..."
        kill $DASHBOARD_PID 2>/dev/null || echo "  Already stopped"
    fi
    
    rm -rf .pids
else
    echo "⚠️  No PID files found. Killing all node processes related to OrderFlow..."
    pkill -f "order-service" || true
    pkill -f "inventory-service" || true
    pkill -f "payment-service" || true
fi

echo ""
echo "🐳 Stopping Docker infrastructure..."
npm run docker:down

echo ""
echo "✅ All services stopped!"
