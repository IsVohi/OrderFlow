# Order Service

> Manages order lifecycle, state transitions, and order saga orchestration

## Description

The Order Service is responsible for:
- Order creation and validation
- Order state machine management
- Publishing order events to Kafka
- Handling compensating transactions
- Maintaining order aggregate data

## State Machine

```
PENDING → CONFIRMED → PAYMENT_PENDING → PAID → FULFILLED → COMPLETED
     ↓          ↓             ↓            ↓
        CANCELLED ←──────────────────────────
```

## Environment Variables

See `.env.example` for required configuration.

## Local Development

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm prisma:generate

# Run migrations
pnpm prisma:migrate:dev

# Start in development mode
pnpm dev
```

## Testing

```bash
# Unit tests
pnpm test

# E2E tests
pnpm test:e2e

# Coverage
pnpm test:cov
```

## API Endpoints

- `GET /health` - Health check
- `POST /orders` - Create new order
- `GET /orders/:id` - Get order by ID
- `GET /orders` - List orders
- `DELETE /orders/:id` - Cancel order
