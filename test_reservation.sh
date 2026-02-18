
#!/bin/bash
# Test Reservation Flow

echo "Creating Order to trigger reservation..."
curl -v -X POST http://localhost:3001/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "x-user-id: usr_buyer_test_res" \
  -H "x-user-role: USER" \
  -d '{
    "customerId": "usr_buyer_test_res",
    "currency": "USD",
    "shippingAddress": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA"
    },
    "items": [
      {
        "productId": "prod_001",
        "quantity": 5,
        "price": 100,
        "sellerId": "unknown-seller"
      }
    ]
  }'
