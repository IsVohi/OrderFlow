# OrderFlow 🚀

> **A real-world demonstration of distributed systems done right.** OrderFlow shows how modern e-commerce platforms handle orders across multiple services without compromising data consistency or user experience.

---

## What's This All About?

Think about what happens when you click "Place Order" on an e-commerce site. Behind the scenes, multiple systems need to coordinate:
- Check if the item is in stock
- Reserve it so nobody else can buy it
- Process your payment
- Update inventory when you pay
- Handle failures gracefully (what if your card gets declined?)

**OrderFlow demonstrates how to build this the right way** using distributed architecture patterns that companies like Amazon, Uber, and Netflix rely on. It's a production-quality system that you can actually run on your laptop.

---

## Why This Project Exists

Most tutorials and demos show you the "happy path" - what happens when everything works perfectly. But that's not reality.

**Real systems need to handle:**
- Services going down mid-transaction
- Multiple people trying to buy the last item simultaneously
- Network failures between payment and inventory systems
- The same event being processed twice (or not at all!)

OrderFlow handles all of this, and you can see exactly how by reading the code.

---

## What Makes It Special?

### 🎯 Real Distributed Systems Patterns

**Saga Choreography**  
No central orchestrator telling everyone what to do. Each service listens for events and decides what to do next. It's like a well-rehearsed dance where everyone knows their part.

**Transactional Outbox**  
Never lose an event, even if Kafka crashes right after your database commit. Events are saved in the same transaction as your data, then published separately.

**Idempotent Consumers**  
Process the same message 10 times? No problem. The system knows what it's already done and won't charge your card twice.

**Automatic Compensation**  
Payment failed? Inventory gets unreserved automatically. Order cancelled? Refund happens without anyone clicking a button.

### 🎨 Complete User Experience

This isn't just backend infrastructure. OrderFlow includes a full dashboard with:
- **Customer View**: Browse products, create orders, make payments (with a pretty payment form!)
- **Seller View**: Manage inventory, confirm orders, fulfill shipments
- **Admin View**: Monitor system health, view audit logs, inject chaos for testing

### 🔧 Production-Grade Tooling

- **CI/CD Pipeline**: Automated type checking and code quality on every push
- **Observability**: See exactly what's happening across all services
- **Chaos Testing**: Break things on purpose to prove the system handles failures
- **30-Minute Reservation TTL**: Customers have half an hour to complete checkout before inventory is released

---

## How It Works (The Non-Technical Version)

Let's walk through what happens when a customer places an order:

### Step 1: Customer Creates Order 📦
You browse the seller's products and add 2 widgets to your cart. Click "Create Order" → Order ID created, status: **PENDING**

### Step 2: Seller Confirms 👍
The seller sees your order in their dashboard and clicks "Confirm Order". This reserves your items so nobody else can buy them. Status: **CONFIRMED**

*Here's the cool part:* The reservation will automatically expire after 30 minutes if you don't pay. No manual cleanup needed!

### Step 3: Customer Pays 💳
You get a payment link, enter your card details, hit submit. If successful, status: **PAID**

*What if payment fails?* The inventory automatically gets unreserved and the order is marked **CANCELLED**. Everything rolls back cleanly.

### Step 4: Seller Fulfills 📮
Seller ships the product and clicks "Fulfill Order". This permanently reduces inventory stock. Status: **FULFILLED**

**The entire flow happens across three separate microservices that never talk to each other directly.** They only communicate through events, yet everything stays consistent.

---

## The Technical Stack (For Engineers)

### Core Architecture
```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Orders    │    │  Inventory   │    │   Payment   │
│  Service    │───▶│   Service    │───▶│   Service   │
│  (port 3001)│    │  (port 3002) │    │  (port 3003)│
└──────┬──────┘    └──────┬───────┘    └──────┬──────┘
       │                  │                    │
       └──────────────────┼────────────────────┘
                    Apache Kafka
                  (Event Backbone)
```

- **Backend**: Node.js + NestJS + TypeScript
- **Databases**: PostgreSQL (one per service)
- **Events**: Apache Kafka for service communication
- **Frontend**: Next.js dashboard with role-based views
- **ORM**: Prisma for type-safe database access
- **Monitoring**: Structured logging with correlation IDs

### What Each Service Does

**Order Service** (3001)  
Owns the order lifecycle. Tracks status from PENDING → CONFIRMED → PAID → FULFILLED. Never touches inventory or payment directly.

**Inventory Service** (3002)  
Knows what's in stock, what's reserved, and for how long. Handles reservations with automatic TTL expiration (30 minutes).

**Payment Service** (3003)  
Processes payments (mocked, but structured like real integrations). Handles retries, idempotency, and refunds.

**Dashboard** (Next.js)  
The face of the system. Different UI for customers, sellers, and admins. Real-time order tracking with saga timeline visualization.

---

## Getting Started

### Prerequisites
- **Node.js** 20+
- **Docker Desktop** (for Postgres and Kafka)
- **pnpm** 8+

### Quick Start (3 minutes)

```bash
# 1. Install dependencies
pnpm install

# 2. Start infrastructure (Postgres, Kafka, Zookeeper)
pnpm docker:up

# 3. Run database migrations
cd apps/order-service && npx prisma migrate dev
cd apps/inventory-service && npx prisma migrate dev
cd apps/payment-service && npx prisma migrate dev

# 4. Start all services (opens 4 terminals)
./start-all.sh
```

**Access the dashboard:** http://localhost:3000

**Test accounts:**
- **Customer**: `user@orderflow.io` / `User1234!`
- **Seller**: `seller@orderflow.io` / `Seller123!`
- **Admin**: `admin@orderflow.io` / `Admin123!`

---

## See It In Action

### Complete Order Flow Demo

1. **Login as Seller** → Add a product (e.g., "Test Widget", $29.99, 10 in stock)
2. **Login as Customer** → Create order for 2 widgets
3. **Back to Seller** → Confirm the order (reserves inventory)
4. **Back to Customer** → Pay for the order (mock payment form)
5. **Back to Seller** → Fulfill order (reduces stock from 10 → 8)

**Watch the Saga Timeline** show each step completing in real-time!

### Test Failure Handling

1. **Login as Admin** → Go to Chaos Testing
2. **Enable Payment Failures** (set to 50%)
3. **Login as Customer** → Create an order
4. Watch it fail randomly - inventory gets unreserved automatically
5. **Check Inventory** → Stock is back to original level (compensation worked!)

---

## What You Can Learn From This

If you're studying distributed systems, this project demonstrates:

✅ **Saga Pattern** - Long-running transactions across services  
✅ **Event-Driven Architecture** - Loosely coupled services  
✅ **Transactional Outbox** - Reliable event publishing  
✅ **Idempotency** - Handling duplicate messages  
✅ **Eventual Consistency** - Living without distributed transactions  
✅ **Compensation Logic** - Rolling back across service boundaries  
✅ **Observability** - Tracking requests across services  
✅ **Chaos Engineering** - Testing failure scenarios

---

## What's Intentionally Simple

This is a learning platform, not a production deployment guide. Some things are deliberately simplified:

| What's Simplified | Why |
|------------------|-----|
| **Payment Gateway** | Uses a mock - actual gateway integration follows the same pattern |
| **Authentication** | JWT validation is mocked - production would use Auth0/Cognito |
| **Deployment** | Docker Compose instead of Kubernetes - easier to run locally |
| **Image Uploads** | Products don't support images yet - keeps focus on distributed patterns |
| **Real-time Updates** | No WebSockets - polling is simpler and works fine here |

---

## Project Stats

📊 **Lines of Code**: ~15,000  
🎯 **Services**: 3 microservices + 1 dashboard  
✅ **Test Coverage**: E2E flow verified through browser automation  
🏗️ **Architecture Docs**: Detailed walkthrough in [architecture.md](./ARCHITECTURE.md)  
⚡ **Startup Time**: ~30 seconds for full stack  

---

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Deep dive into the system design
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Production & VPS setup
- **[CI/CD Guide](./docs/CI-CD.md)** - Automated testing pipeline setup
- **[Proven Scenarios](./docs/PROVEN-SCENARIOS.md)** - Tested failure scenarios and recovery patterns
- **[Kafka Setup](./infra/kafka/README.md)** - Event streaming infrastructure

---

## Contributing

This is a demonstration project, but if you spot bugs or have ideas for improvements, feel free to open an issue!

**Ideas for extensions:**
- Add product images and file uploads
- Implement real-time order updates via WebSockets  
- Add email notifications for order status changes
- Implement search and filtering on the storefront
- Add Swagger/OpenAPI documentation

---

## License

MIT - Use this however you want to learn or teach distributed systems!

---

**Built with ❤️ to show that distributed systems don't have to be scary.**

*Questions? Check out the [detailed architecture docs](./ARCHITECTURE.md) for implementation details and patterns.*
