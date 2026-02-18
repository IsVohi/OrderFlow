
# Create Product
echo "Creating Product..."
curl -X POST http://localhost:3002/api/v1/inventory \
  -H "Content-Type: application/json" \
  -H "x-user-id: usr_seller123" \
  -H "x-user-role: SELLER" \
  -d '{
    "id": "prod_001",
    "name": "Test Product",
    "description": "A great test product",
    "price": 100,
    "totalStock": 50,
    "imageUrl": "https://example.com/image.jpg"
  }'

echo "\n\nCreating Order..."
# Create Order
curl -X POST http://localhost:3001/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "x-user-id: usr_buyer456" \
  -H "x-user-role: USER" \
  -d '{
    "customerId": "usr_buyer456",
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
        "quantity": 2,
        "price": 100,
        "sellerId": "unknown-seller"
      }
    ]
  }'
