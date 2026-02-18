
#!/bin/bash
ORDER_ID="ord_1771252426927_9a223a90"

echo "Confirming Order..."
curl -X POST http://localhost:3001/api/v1/orders/$ORDER_ID/confirm

echo "\n\nPaying Order..."
curl -X POST http://localhost:3001/api/v1/orders/$ORDER_ID/pay

echo "\n\nFulfilling Order..."
curl -X POST http://localhost:3001/api/v1/orders/$ORDER_ID/fulfill

echo "\n\nChecking Reservation Status..."
sleep 2
curl -v http://localhost:3002/api/v1/inventory/reservations/list
