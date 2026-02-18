# OrderFlow Architecture Guide 🏗️

> **How we built a distributed order processing system that actually works**  
> This document explains the technical decisions, patterns, and trade-offs that make OrderFlow reliable.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Architectural Views (4+1 Model)](#2-architectural-views-41-model)
3. [Why These Patterns?](#3-why-these-patterns)
4. [Service Breakdown](#4-service-breakdown)
5. [The Order Lifecycle](#5-the-order-lifecycle)
6. [Event Choreography](#6-event-choreography)
7. [Handling Failures](#7-handling-failures)
8. [Data Consistency](#8-data-consistency)
9. [Observability](#9-observability)
10. [Deployment & Scaling](#10-deployment--scaling)
11. [Security Considerations](#11-security-considerations)
12. [Production Readiness](#12-production-readiness)

---

## 1. Architecture Overview

### The Big Picture

OrderFlow is built on **event-driven microservices**. Each service owns its data and communicates with others only through Kafka events. No service directly calls another service's API.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Order Service  │────▶│Inventory Service│────▶│ Payment Service │
│   Port 3001     │     │   Port 3002     │     │   Port 3003     │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       ▼                       ▼
    ┌─────────┐            ┌─────────┐            ┌─────────┐
    │order-db │            │ inv-db  │            │ pay-db  │
    └─────────┘            └─────────┘            └─────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                          ┌──────▼──────┐
                          │    Kafka    │
                          │   Topics    │
                          └─────────────┘
```

### Core Principles

**1. Event-Driven Communication**  
Services don't know about each other. They publish events ("I created an order") and react to events they care about ("Payment succeeded? Cool, let me fulfill that").

**2. Database Per Service**  
Each service owns its database. No cross-service SQL queries. This lets services evolve independently.

**3. Eventual Consistency**  
Data might be briefly out of sync across services. That's okay! We guarantee it'll be consistent *eventually* through event processing.

**4. Choreography Over Orchestration**  
No central "order manager" telling everyone what to do. Each service knows its role and acts autonomously.

---

## 2. Architectural Views (4+1 Model)

We use the **4+1 Architectural View Model** to describe OrderFlow from different perspectives:

### Logical View: Component Architecture

This shows what components exist and how they relate to each other:

```
┌────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Next.js Dashboard (Port 3000)                │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────────┐    │  │
│  │  │Customer│  │ Seller │  │ Admin  │  │Observability│    │  │
│  │  │  View  │  │  View  │  │  View  │  │   Tools     │    │  │
│  │  └────────┘  └────────┘  └────────┘  └────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬───────────────────────────────┘
                                 │ HTTP/REST
                                 ▼
┌────────────────────────────────────────────────────────────────┐
│                      Application Services                       │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │ Order Service   │  │Inventory Service│  │Payment Service  ││
│  │                 │  │                 │  │                 ││
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐││
│  │ │Controllers  │ │  │ │Controllers  │ │  │ │Controllers  │││
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘││
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐││
│  │ │Domain       │ │  │ │Reservation  │ │  │ │Payment      │││
│  │ │Services     │ │  │ │Manager      │ │  │ │Processor    │││
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘││
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐││
│  │ │Event        │ │  │ │TTL Manager  │ │  │ │Idempotency  │││
│  │ │Handlers     │ │  │ │(30 min)     │ │  │ │Tracker      │││
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘││
│  └─────────────────┘  └─────────────────┘  └─────────────────┘│
│           │                    │                     │          │
└───────────┼────────────────────┼─────────────────────┼──────────┘
            │                    │                     │
            └────────────────────┼─────────────────────┘
                                 ▼
┌────────────────────────────────────────────────────────────────┐
│                      Event Backbone (Kafka)                     │
│                                                                  │
│  Topics: order-events, inventory-events, payment-events         │
│  Pattern: Transactional Outbox + Idempotent Consumers          │
└────────────────────────────────────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Order Database │    │Inventory Database│   │Payment Database │
│   (PostgreSQL)  │    │   (PostgreSQL)   │   │  (PostgreSQL)   │
│                 │    │                  │   │                 │
│ • orders        │    │ • inventory      │   │ • payments      │
│ • order_items   │    │ • reservations   │   │ • transactions  │
│ • order_events  │    │ • products       │   │ • processed_    │
│ • outbox        │    │ • outbox         │   │   events        │
└─────────────────┘    └─────────────────┘   └─────────────────┘
```

**Key Components:**

- **Controllers**: Handle HTTP requests, validate input
- **Domain Services**: Business logic (order state machine, reservation logic, payment processing)
- **Event Handlers**: React to Kafka events, maintain idempotency
- **Background Jobs**: Outbox publisher, TTL expiration checker
- **Databases**: Each service has exclusive ownership

### Process View: Saga Choreography Flow

This shows how a successful order flows through the system:

```
Customer          Order           Inventory        Payment         Order
  │               Service          Service         Service        Service
  │                 │                 │               │              │
  ├─Create Order───▶│                 │               │              │
  │                 │                 │               │              │
  │                 ├─order.created──▶│               │              │
  │                 │                 │               │              │
  │                 │                 ├─Reserve(30m)  │              │
  │                 │                 │               │              │
  │                 │◀─inventory.────┤│               │              │
  │                 │   reserved      │               │              │
  │                 │                 │               │              │
  │                 │                 ├─inventory.───▶│              │
  │                 │                 │   reserved    │              │
  │                 │                 │               │              │
  │                 │                 │               ├─Process      │
  │                 │                 │               │  Payment     │
  │                 │                 │               │              │
  │                 │                 │◀─payment.────┤│              │
  │                 │                 │   succeeded   │              │
  │                 │                 │               │              │
  │                 │◀─payment.──────────────────────┤│              │
  │                 │   succeeded                     │              │
  │                 │                                 │              │
  │                 ├─Update: PAID                    │              │
  │                 │                                 │              │
  │                 ├─order.fulfilled─────────────────────────────▶│
  │                 │                                 │              │
  │                 │                 ◀─order.────────────────────┤│
  │                 │                    fulfilled    │              │
  │                 │                 │               │              │
  │                 │                 ├─Commit Stock  │              │
  │                 │                 │  (Reduce qty) │              │
  │                 │                 │               │              │
  │◀─Order Complete─┤                 │               │              │
```

### Development View: Code Organization

Shows the physical structure of the codebase:

```
OrderFlow/ (Monorepo)
│
├── apps/
│   ├── order-service/
│   │   ├── src/
│   │   │   ├── application/
│   │   │   │   ├── controllers/      (HTTP endpoints)
│   │   │   │   ├── services/         (Business logic)
│   │   │   │   └── dtos/             (Data contracts)
│   │   │   ├── infrastructure/
│   │   │   │   ├── messaging/        (Kafka producers/consumers)
│   │   │   │   ├── persistence/      (Prisma models)
│   │   │   │   └── jobs/             (Background jobs)
│   │   │   └── config/
│   │   └── prisma/
│   │       └── schema.prisma
│   │
│   ├── inventory-service/
│   │   └── [similar structure]
│   │
│   ├── payment-service/
│   │   └── [similar structure]
│   │
│   └── dashboard/                    (Next.js)
│       ├── src/
│       │   ├── app/                  (App Router pages)
│       │   ├── components/           (UI components)
│       │   └── actions/              (Server actions)
│       └── public/
│
├── packages/                         (Shared libraries)
│   ├── common/                       (Shared types, utils)
│   ├── logger/                       (Structured logging)
│   └── kafka/                        (Kafka client wrapper)
│
├── docker-compose.yml                (Local infrastructure)
├── .github/workflows/                (CI/CD)
├── pnpm-workspace.yaml               (Monorepo config)
└── README.md
```

### Physical View: Deployment Architecture

Shows how components are deployed in different environments:

```
┌─────────────────────────────────────────────────────────────┐
│                   Production Environment                     │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │             Load Balancer (Nginx/ALB)                  │  │
│  └────────────┬──────────────┬──────────────┬─────────────┘  │
│               │              │              │                 │
│    ┌──────────▼──────┐  ┌───▼──────┐  ┌───▼──────┐          │
│    │   Dashboard     │  │ Order-1  │  │ Order-2  │          │
│    │  (Container)    │  │(Container│  │(Container│          │
│    └─────────────────┘  └──────────┘  └──────────┘          │
│                                                               │
│    ┌─────────────────┐  ┌─────────────────┐                 │
│    │  Inventory-1    │  │  Payment-1      │                 │
│    │  (Container)    │  │  (Container)    │                 │
│    └─────────────────┘  └─────────────────┘                 │
│               │              │              │                 │
│               └──────────────┼──────────────┘                │
│                              ▼                                │
│         ┌────────────────────────────────────┐               │
│         │     Apache Kafka Cluster           │               │
│         │  ┌────────┐ ┌────────┐ ┌────────┐ │               │
│         │  │Broker 1│ │Broker 2│ │Broker 3│ │               │
│         │  └────────┘ └────────┘ └────────┘ │               │
│         └────────────────────────────────────┘               │
│                              │                                │
│         ┌────────────────────┼────────────────┐              │
│         ▼                    ▼                ▼              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐    │
│  │  order-db    │   │ inventory-db │   │  payment-db  │    │
│  │  (Primary)   │   │  (Primary)   │   │  (Primary)   │    │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘    │
│         │                  │                   │             │
│    ┌────▼─────┐       ┌────▼─────┐       ┌────▼─────┐      │
│    │ Replica  │       │ Replica  │       │ Replica  │      │
│    └──────────┘       └──────────┘       └──────────┘      │
│                                                               │
│  Observability Stack:                                        │
│  ├─ Prometheus (metrics)                                     │
│  ├─ Grafana (dashboards)                                     │
│  └─ Jaeger (distributed tracing)                             │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Scenario View: Key Use Cases

**Use Case 1: Successful Order**
1. Customer creates order → Order PENDING
2. Inventory reserved (30-min TTL) → Order CONFIRMED  
3. Payment succeeds → Order PAID
4. Seller fulfills → Order FULFILLED, stock reduced

**Use Case 2: Payment Failure**
1. Customer creates order → Order PENDING
2. Inventory reserved → Order CONFIRMED
3. Payment fails → Automatic compensation triggered
4. Inventory unreserved → Order CANCELLED

**Use Case 3: Reservation Expiry**
1. Customer creates order → Inventory reserved
2. Customer abandons checkout (doesn't pay)
3. 30 minutes pass → Background job releases reservation
4. Stock returns to available pool
5. Order auto-cancelled

---

## 3. Why These Patterns?

### The Problem We're Solving

Imagine building this with traditional RPC (service-to-service API calls):

```javascript
// ❌ Fragile synchronous approach
async function createOrder(orderData) {
  const order = await orderService.create(orderData);
  const reservation = await inventoryService.reserve(order.items);  // What if this fails?
  const payment = await paymentService.charge(order.total);         // What if this fails?
  await orderService.confirm(order.id);                             // What if this fails?
}
```

**Problems:**
- If inventory service is down, the whole flow fails
- If we successfully reserve inventory but payment fails, we need complex rollback logic
- Services are tightly coupled (order service needs to know inventory service's API)
- Timeouts cascade (payment gateway is slow → everything waits)

### The Event-Driven Solution

```javascript
// ✅ Resilient event-driven approach
async function createOrder(orderData) {
  const order = await db.create(orderData);
  await publishEvent('order.created', order);
  return order;  // Done! Other services will react asynchronously
}
```

**Benefits:**
- Each service processes events at its own pace
- Failures are isolated (payment service down? Events wait in Kafka)
- Services only know about events, not each other
- Natural retry and recovery (events persist until processed)

---

## 3. Service Breakdown

### Order Service (The Coordinator)

**What it does:**  
Tracks the order lifecycle from creation to completion. It's the "source of truth" for order status.

**Database Schema:**
```sql
-- Orders table
CREATE TABLE orders (
  id VARCHAR(255) PRIMARY KEY,
  customer_id VARCHAR(255) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL,  -- PENDING, CONFIRMED, PAID, FULFILLED
  created_at TIMESTAMP DEFAULT NOW()
);

-- Order items
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(255) REFERENCES orders(id),
  product_id VARCHAR(255) NOT NULL,
  seller_id VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL
);

-- Event log (audit trail)
CREATE TABLE order_events (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(255) REFERENCES orders(id),
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB,
  occurred_at TIMESTAMP DEFAULT NOW()
);
```

**Events it publishes:**
- `order.created` - When a customer creates an order
- `order.cancelled` - When an order is cancelled (user action or failure)
- `order.fulfilled` - When seller marks order as shipped

**Events it listens to:**
- `inventory.reserved` - Updates status to CONFIRMED
- `payment.succeeded` - Updates status to PAID
- `payment.failed` - Cancels the order

**Why this separation?**  
Orders don't know *how* to reserve inventory or process payments. They just react to outcomes.

---

### Inventory Service (The Gatekeeper)

**What it does:**  
Manages stock levels and handles reservations with automatic expiration.

**Database Schema:**
```sql
-- Product inventory
CREATE TABLE inventory (
  product_id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE NOT NULL,
  quantity_available INTEGER NOT NULL,
  quantity_reserved INTEGER DEFAULT 0,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reservations (with TTL)
CREATE TABLE reservations (
  id VARCHAR(255) PRIMARY KEY,
  order_id VARCHAR(255) UNIQUE NOT NULL,
  product_id VARCHAR(255) REFERENCES inventory(product_id),
  quantity INTEGER NOT NULL,
  status VARCHAR(50),  -- RESERVED, COMMITTED, RELEASED, EXPIRED
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**The 30-Minute TTL:**  
When inventory is reserved, it's marked with an expiration time 30 minutes in the future. A background job runs every minute checking for expired reservations and automatically releases them.

```javascript
// Background job (runs every minute)
async function releaseExpiredReservations() {
  const expired = await db.reservations.findMany({
    where: {
      status: 'RESERVED',
      expires_at: { lt: new Date() }  // Past expiration
    }
  });
  
  for (const reservation of expired) {
    await unreserveInventory(reservation);
    await publishEvent('inventory.released', { reason: 'expired' });
  }
}
```

**Events it publishes:**
- `inventory.reserved` - Stock successfully reserved
- `inventory.reservation_failed` - Not enough stock
- `inventory.released` - Reservation cancelled (payment failed or TTL expired)
- `inventory.committed` - Stock permanently reduced (order fulfilled)

**Events it listens to:**
- `order.created` - Attempt to reserve stock
- `payment.failed` - Release the reservation
- `order.fulfilled` - Commit the reservation (reduce available stock)

---

### Payment Service (The Money Handler)

**What it does:**  
Processes payments using a mock gateway (structured like real integrations would be).

**Database Schema:**
```sql
-- Payment transactions
CREATE TABLE payments (
  id VARCHAR(255) PRIMARY KEY,
  order_id VARCHAR(255) UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL,  -- PENDING, SUCCEEDED, FAILED
  payment_method VARCHAR(100),
  transaction_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Idempotency tracking
CREATE TABLE processed_events (
  event_id VARCHAR(255) PRIMARY KEY,
  processed_at TIMESTAMP DEFAULT NOW()
);
```

**Why idempotency matters:**  
Kafka delivers messages "at least once". If the payment service crashes after charging a card but before acknowledging the event, Kafka will redeliver it. Without idempotency tracking, we'd double-charge the customer!

```javascript
async function processPayment(event) {
  // Check if we've already processed this exact event
  const alreadyProcessed = await db.processed_events.findUnique({
    where: { event_id: event.metadata.eventId }
  });
  
  if (alreadyProcessed) {
    console.log('Already processed, skipping');
    return;  // Idempotent! Safe to process multiple times
  }
  
  // Process payment and record event ID in same transaction
  await db.$transaction([
    db.payments.create({ /* payment data */ }),
    db.processed_events.create({ event_id: event.metadata.eventId })
  ]);
}
```

**Events it publishes:**
- `payment.succeeded` - Payment went through
- `payment.failed` - Payment was declined or error occurred

**Events it listens to:**
- `inventory.reserved` - Time to charge the customer

---

## 4. The Order Lifecycle

### Happy Path: Everything Works

Let's trace a successful order from start to finish:

**Step 1: Customer Creates Order** (`POST /api/v1/orders`)
```
User clicks "Create Order"
  ↓
Order Service creates order record (status: PENDING)
  ↓
Order Service writes to transactional outbox
  ↓
Outbox publisher sends order.created event to Kafka
```

**Step 2: Inventory Reservation**
```
Inventory Service receives order.created event
  ↓
Checks if enough stock available
  ↓
Creates reservation record (expires_at: now + 30 mins)
  ↓
Updates inventory (quantity_reserved += 2)
  ↓
Publishes inventory.reserved event
```

**Step 3: Payment Processing**
```
Payment Service receives inventory.reserved event
  ↓
Calls payment gateway (or mock)
  ↓
Payment succeeds
  ↓
Publishes payment.succeeded event
```

**Step 4: Order Confirmation**
```
Order Service receives payment.succeeded event
  ↓
Updates order status to PAID
  ↓
Seller fulfills order (manual action)
  ↓
Order Service publishes order.fulfilled event
```

**Step 5: Inventory Commitment**
```
Inventory Service receives order.fulfilled event
  ↓
Updates reservation status to COMMITTED
  ↓
Reduces quantity_available (10 → 8)
  ↓
Reduces quantity_reserved (2 → 0)
```

**Final state:**
- Order: FULFILLED ✅
- Payment: SUCCEEDED ✅
- Inventory: Reduced by order quantity ✅

---

### Failure Path: Payment Declined

What happens when the customer's card is declined?

**Steps 1-2:** Same as happy path (order created, inventory reserved)

**Step 3: Payment Fails**
```
Payment Service receives inventory.reserved event
  ↓
Calls payment gateway
  ↓
Payment DECLINED (insufficient funds)
  ↓
Publishes payment.failed event
```

**Step 4: Automatic Compensation**
```
Inventory Service receives payment.failed event
  ↓
Finds reservation for this order
  ↓
Unreserves inventory (quantity_reserved -= 2)
  ↓
Updates reservation status to RELEASED
  ↓
Publishes inventory.released event
```

**Step 5: Order Cancellation**
```
Order Service receives payment.failed event
  ↓
Updates order status to CANCELLED
  ↓
Marks cancellation reason: "payment_failed"
```

**Final state:**
- Order: CANCELLED ❌
- Payment: FAILED ❌
- Inventory: Back to original levels ✅ (compensation worked!)

**The magic:** All of this happens automatically. No manual cleanup, no "corrupt state" where inventory stays reserved forever.

---

## 5. Event Choreography

### How Services Know What to Do

Each service has event handlers that define its reactions:

**Order Service Event Handlers:**
```javascript
// When inventory gets reserved, move order forward
on('inventory.reserved', async (event) => {
  await updateOrderStatus(event.orderId, 'CONFIRMED');
});

// When payment succeeds, mark as paid
on('payment.succeeded', async (event) => {
  await updateOrderStatus(event.orderId, 'PAID');
});

// When payment fails, cancel the order
on('payment.failed', async (event) => {
  await updateOrderStatus(event.orderId, 'CANCELLED');
});
```

**Inventory Service Event Handlers:**
```javascript
// When order is created, try to reserve stock
on('order.created', async (event) => {
  const hasStock = await checkAvailability(event.items);
  if (hasStock) {
    await reserveInventory(event.orderId, event.items);
    await publish('inventory.reserved');
  } else {
    await publish('inventory.reservation_failed');
  }
});

// When payment fails, release the reservation
on('payment.failed', async (event) => {
  await unreserveInventory(event.orderId);
  await publish('inventory.released');
});

// When order is fulfilled, permanently reduce stock
on('order.fulfilled', async (event) => {
  await commitInventory(event.orderId);
});
```

**Payment Service Event Handlers:**
```javascript
// When inventory is reserved, process payment
on('inventory.reserved', async (event) => {
  const result = await paymentGateway.charge(event.amount);
  if (result.success) {
    await publish('payment.succeeded');
  } else {
    await publish('payment.failed', { reason: result.error });
  }
});
```

### The Dance Analogy

Think of it like a choreographed dance:
- Each dancer (service) knows their own moves
- They react to music cues (events)
- No one dancer controls the others
- If someone misses a cue, the dance adjusts (compensation)

---

## 6. Handling Failures

### The Transactional Outbox Pattern

**The Problem:**  
How do you guarantee that when you save something to the database, the corresponding event always makes it to Kafka?

**Naive approach (doesn't work):**
```javascript
// ❌ What if we crash between these two lines?
await db.createOrder(order);
await kafka.publish('order.created', order);  // Might never happen!
```

**Transactional Outbox (works!):**
```javascript
// ✅ Both writes happen in one transaction
await db.$transaction([
  db.orders.create({ /* order data */ }),
  db.outbox.create({    // Write event to local database
    eventType: 'order.created',
    payload: order,
    published: false
  })
]);

// Separate publisher process reads outbox and publishes to Kafka
setInterval(async () => {
  const unpublished = await db.outbox.findMany({ where: { published: false } });
  for (const event of unpublished) {
    await kafka.publish(event.eventType, event.payload);
    await db.outbox.update({ where: { id: event.id }, data: { published: true } });
  }
}, 1000);  // Poll every second
```

**Why it works:**  
The database transaction guarantees that either BOTH the order and the outbox event are saved, or NEITHER are. Once in the outbox, the publisher will eventually send it to Kafka (with retries).

---

### Idempotent Event Processing

**The Problem:**  
Kafka uses "at least once" delivery. You might receive the same event multiple times.

**Solution: Track Processed Events**
```sql
CREATE TABLE processed_events (
  event_id VARCHAR(255) PRIMARY KEY,
  processed_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_processed_at (processed_at)
);
```

**Handler Pattern:**
```javascript
async function handleEvent(event) {
  // Start transaction
  await db.$transaction(async (tx) => {
    // Check if already processed
    const existing = await tx.processed_events.findUnique({
      where: { event_id: event.metadata.eventId }
    });
    
    if (existing) {
      console.log('Duplicate event, skipping');
      return;  // Already processed!
    }
    
    // Process the event
    await tx.payments.create({ /* ... */ });
    
    // Mark as processed
    await tx.processed_events.create({
      event_id: event.metadata.eventId
    });
  });
}
```

**Cleanup:**  
Old `processed_events` records can be deleted after 30 days (events older than that won't be replayed).

---

### Reservation TTL (Time-To-Live)

**The Problem:**  
Customer adds item to cart, we reserve inventory, but they never pay. Inventory stays locked forever.

**Solution: Automatic Expiration**

When creating a reservation:
```javascript
const reservation = await db.reservations.create({
  order_id: orderId,
  product_id: productId,
  quantity: 2,
  status: 'RESERVED',
  expires_at: new Date(Date.now() + 30 * 60 * 1000)  // 30 minutes from now
});
```

Background job (runs every minute):
```javascript
// Find and release expired reservations
const expired = await db.reservations.findMany({
  where: {
    status: 'RESERVED',
    expires_at: { lt: new Date() }
  }
});

for (const res of expired) {
  // Add inventory back to available pool
  await db.inventory.update({
    where: { product_id: res.product_id },
    data: {
      quantity_reserved: { decrement: res.quantity }
    }
  });
  
  // Mark reservation as expired
  await db.reservations.update({
    where: { id: res.id },
    data: { status: 'EXPIRED' }
  });
  
  // Notify order service
  await publishEvent('inventory.released', {
    order_id: res.order_id,
    reason: 'ttl_expired'
  });
}
```

**Why 30 minutes?**  
Long enough for normal checkout, short enough to prevent abuse. Configurable based on business needs.

---

## 7. Data Consistency

### Eventual Consistency in Action

Imagine this timeline:

```
T+0s:  Customer creates order
       → Order DB shows: status = PENDING
       → Inventory DB shows: no reservation yet
       ❌ Data is INCONSISTENT

T+0.5s: Inventory service processes order.created event
        → Inventory DB shows: reservation created, stock reserved
        ❌ Still inconsistent (order vs inventory view)

T+1s:   Order service processes inventory.reserved event
        → Order DB shows: status = CONFIRMED
        ✅ Data is CONSISTENT

T+2s:   Payment service processes inventory.reserved event
        → Payment DB shows: payment processing
        ❌ Inconsistent again (payment in progress)

T+3s:   Payment completes
        → Payment service publishes payment.succeeded
        ❌ Payment knows, but others don't yet

T+4s:   Order service processes payment.succeeded
        → Order DB shows: status = PAID
        ✅ Eventually consistent!
```

**The key insight:**  
We accept temporary inconsistency (seconds-long) in exchange for:
- High availability (no distributed locks)
- Service independence (they don't coordinate)
- Resilience (failures don't cascade)

### Strong Consistency Where It Matters

Within each service, we use ACID transactions:

```javascript
// Inventory reservation uses pessimistic locking
await db.$transaction(async (tx) => {
  // Lock this row until transaction completes
  const product = await tx.inventory.findUnique({
    where: { product_id: 'prod_123' },
    lock: { exclusive: true }  // Nobody else can modify this row
  });
  
  if (product.quantity_available < requestedQty) {
    throw new Error('Insufficient inventory');
  }
  
  await tx.inventory.update({
    where: { product_id: 'prod_123' },
    data: {
      quantity_reserved: { increment: requestedQty }
    }
  });
  
  await tx.reservations.create({ /* ... */ });
});
```

This prevents **overselling**: Two customers trying to buy the last item at the same time won't both succeed.

---

## 8. Observability

### How We Track Requests Across Services

Every request gets a **correlation ID** that flows through all services:

```javascript
// Order service creates correlation ID
const correlationId = generateId();

await publishEvent('order.created', {
  metadata: {
    eventId: generateId(),
    correlationId: correlationId,  // <-- Track this through entire flow
    timestamp: new Date().toISOString()
  },
  payload: { /* order data */ }
});
```

**When inventory service processes the event:**
```javascript
function handleOrderCreated(event) {
  const correlationId = event.metadata.correlationId;
  
  logger.info('Processing order', {
    correlationId,  // <-- Same ID!
    orderId: event.payload.orderId,
    service: 'inventory-service'
  });
  
  // When publishing next event, carry it forward
  await publishEvent('inventory.reserved', {
    metadata: {
      eventId: generateId(),
      correlationId: correlationId,  // <-- Pass it along
      causationId: event.metadata.eventId
    },
    payload: { /* ... */ }
  });
}
```

**Result:**  
You can grep logs for one correlation ID and see the entire request flow across all services:

```
[order-service]     correlationId=abc123 Order created
[inventory-service] correlationId=abc123 Inventory reserved
[payment-service]   correlationId=abc123 Payment processing
[payment-service]   correlationId=abc123 Payment succeeded
[order-service]     correlationId=abc123 Order confirmed
```

### Structured Logging

All logs are JSON for easy parsing:

```json
{
  "timestamp": "2026-02-17T10:00:00Z",
  "level": "INFO",
  "service": "payment-service",
  "correlationId": "abc123",
  "orderId": "ord_xyz789",
  "amount": 59.98,
  "message": "Payment processed successfully"
}
```

This makes it trivial to:
- Search by correlation ID
- Filter by service
- Alert on errors
- Track payment amounts

---

## Design Trade-offs

### What We Gained

✅ **Service Independence** - Deploy order service without touching payment service  
✅ **Fault Isolation** - Payment service down? Orders still get created  
✅ **Scalability** - Each service scales independently  
✅ **Clear Boundaries** - Each team owns one service  
✅ **Technology Flexibility** - Could rewrite payment service in Go without affecting others

### What We Gave Up

❌ **Immediate Consistency** - Data is eventually consistent (usually < 5 seconds)  
❌ **Simplicity** - More moving parts than a monolith  
❌ **Distributed Debugging** - Need good observability tools  
❌ **Network Dependency** - Kafka must be available  

---

## Summary

OrderFlow demonstrates that distributed systems don't require magic. The patterns are well-understood:

1. **Publish events, don't call APIs** - Services react, they don't orchestrate
2. **One database per service** - Strong consistency locally, eventual consistency globally
3. **Transactional outbox** - Never lose an event
4. **Idempotent handlers** - Safe to process events multiple times
5. **Correlation IDs** - Track requests across services
6. **Automatic compensation** - Failures trigger rollback events

These patterns are used by every major tech company building distributed systems. OrderFlow is a working reference implementation you can study and learn from.

**Ready to dive into the code?** Start with:
- [Order Service](file:///Users/Vikas/Documents/Projects/Mine/OrderFlow/apps/order-service/src) - See how orders are created and tracked
- [Inventory Service](file:///Users/Vikas/Documents/Projects/Mine/OrderFlow/apps/inventory-service/src) - Study the reservation TTL implementation
- [Payment Service](file:///Users/Vikas/Documents/Projects/Mine/OrderFlow/apps/payment-service/src) - See idempotency in action

---

*Questions or want to contribute? Check the [main README](./README.md) or open an issue!*

---

## 9. Deployment & Scaling

### Logical View: Service Deployment

Each service runs as an independent container with its own database:

```
┌─────────────────────────────────────────────────────────┐
│                    Load Balancer                         │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    ┌────────┐  ┌────────┐  ┌────────┐
    │Order-1 │  │Order-2 │  │Order-3 │  ← Horizontal scaling
    └───┬────┘  └───┬────┘  └───┬────┘
        │           │           │
        └───────────┼───────────┘
                    ▼
              ┌──────────┐
              │ order-db │ ← Single source of truth
              │(Primary) │
              └────┬─────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
    ┌─────────┐         ┌─────────┐
    │Read     │         │Read     │  ← Read replicas
    │Replica 1│         │Replica 2│
    └─────────┘         └─────────┘
```

**Scaling Strategy:**
- **Stateless Services**: Order, Inventory, Payment services scale horizontally
- **Kafka Partitioning**: More partitions = more parallel consumers
- **Database**: Vertical scaling for writes, horizontal (replicas) for reads

### Containerization

Each service has its own Dockerfile:

```dockerfile
# Example: Order Service
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

**Resource Limits (Kubernetes):**
```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "250m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Kafka Scaling

**Topic Configuration:**
```
orders-events:       partitions: 10, replication: 3
inventory-events:    partitions: 10, replication: 3
payment-events:      partitions: 10, replication: 3
```

**Consumer Groups:**
- `order-service-group` - Processes inventory & payment events
- `inventory-service-group` - Processes order & payment events  
- `payment-service-group` - Processes inventory events

**Auto-Scaling:**  
When Kafka lag increases (more events queued than processed), Kubernetes HPA adds more consumer pods. Kafka automatically rebalances partitions.

### Database Strategy

**Per-Service Isolation:**
- ✅ Order Service → `order-db` (PostgreSQL)
- ✅ Inventory Service → `inventory-db` (PostgreSQL)
- ✅ Payment Service → `payment-db` (PostgreSQL)

**Why separate databases?**
- Services can't bypass events and query each other's data directly
- Schema changes don't affect other services
- Failures are isolated (one DB down ≠ entire system down)
- Can use different database technologies per service if needed

---

## 10. Security Considerations

### Authentication & Authorization

**Mock Implementation (Current):**
```javascript
// Hardcoded users for demonstration
const users = {
  'user@orderflow.io': { role: 'USER', id: 'user-customer-001' },
  'seller@orderflow.io': { role: 'SELLER', id: 'user-seller-001' },
  'admin@orderflow.io': { role: 'ADMIN', id: 'user-admin-001' }
};
```

**Production Approach:**
```
User Login → Auth Service (Keycloak/Auth0/Cognito)
  ↓
JWT Token Issued
  ↓
API Gateway validates JWT signature
  ↓
Extracts user_id, roles from token claims
  ↓
Passes identity context to services
```

### Role-Based Access Control (RBAC)

**Implemented Roles:**

| Role | Can Do | Cannot Do |
|------|--------|-----------|
| **USER** | Create orders, view own orders, make payments | View other users' orders, manage inventory |
| **SELLER** | View orders for their products, confirm orders, fulfill orders, manage inventory | View orders from other sellers, access admin tools |
| **ADMIN** | View all orders, access observability tools, chaos testing, audit logs | Modify orders (read-only to prevent saga corruption) |

### Data Security

**In Transit:** All HTTP traffic over TLS 1.3  
**At Rest:** Database encryption, sensitive fields encrypted  
**Secrets:** Environment variables, Kubernetes secrets

---

## 11. Production Readiness

### Health Checks

Every service exposes health endpoints:

**Liveness Probe** (`/health/live`): "Is the service running?"  
**Readiness Probe** (`/health/ready`): "Can the service handle traffic?" 

```javascript
app.get('/health/ready', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    kafka: await checkKafka()
  };
  
  const allHealthy = Object.values(checks).every(v => v === 'UP');
  res.status(allHealthy ? 200 : 503).json(checks);
});
```

### Graceful Shutdown

Services finish processing events before shutting down:

```javascript
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await server.close();
  await kafka.consumer.disconnect();
  await db.$disconnect();
  process.exit(0);
});
```

### Circuit Breakers

Prevent cascading failures:

```javascript
const breaker = new CircuitBreaker(paymentGateway.charge, {
  threshold: 5,
  timeout: 30000
});

breaker.on('open', () => {
  logger.error('Payment gateway unreachable');
});
```

---

## 12. What's Intentionally Out of Scope

Understanding what we're **not** building:

**1. Real Payment Gateway** - Mock used, production would integrate Stripe/PayPal  
**2. Production Authentication** - Hardcoded users, production needs Auth0/Keycloak  
**3. Multi-Region Deployment** - Single region only  
**4. Advanced Analytics** - No BI dashboards, raw events available  
**5. Notification Service** - No email/SMS alerts  
**6. Product Recommendations** - Focus on distributed patterns  
**7. Kubernetes Manifests** - Concepts shown, not full deployment files  
**8. Schema Registry** - Events documented, not using Avro/Confluent

---

## 13. Physical View: Deployment Architecture

### Docker Compose (Local Development)

```yaml
services:
  kafka:
    image: confluentinc/cp-kafka:7.4.0
    ports: ["9092:9092"]

  order-db:
    image: postgres:15
    environment:
      POSTGRES_DB: orderdb

  order-service:
    build: ./apps/order-service
    depends_on: [kafka, order-db]
    environment:
      DATABASE_URL: postgresql://...
      KAFKA_BROKERS: kafka:9092
```

### Kubernetes (Production)

**Autoscaling Example:**
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      averageUtilization: 70
  - type: External
    external:
      metric:
        name: kafka_consumer_lag
      target:
        value: "1000"
```

---

## 14. Development View: Code Organization

### Monorepo Structure

```
OrderFlow/
├── apps/
│   ├── order-service/
│   ├── inventory-service/
│   ├── payment-service/
│   └── dashboard/
├── packages/
│   ├── logger/
│   ├── common/
│   └── kafka/
```

**Why monorepo?**
- Shared code changes propagate immediately
- Single install for entire project
- Atomic commits across services
- Easier for learning

### Service Structure (Clean Architecture)

```
order-service/
├── src/
│   ├── application/          ← Business logic
│   │   ├── controllers/
│   │   └── services/
│   ├── infrastructure/       ← Technical details
│   │   ├── messaging/
│   │   └── persistence/
│   └── config/
```

---

## 15. Summary

**Core Patterns Implemented:**
1. ✅ Saga Choreography
2. ✅ Transactional Outbox
3. ✅ Idempotent Consumers
4. ✅ Eventual Consistency
5. ✅ Correlation IDs
6. ✅ Automatic Compensation

**Production Ready:**
- ✅ Health checks, graceful shutdown
- ✅ Structured logging, RBAC
- ✅ 30-min reservation TTL
- ✅ CI/CD pipeline

**For Production, Add:**
- Real payment gateway
- Production auth (Auth0/Keycloak)
- Kubernetes manifests (See [Deployment Guide](./docs/DEPLOYMENT.md))
- Schema registry
- Comprehensive tests
- Monitoring alerts

This architecture balances **learning value** with **production patterns**.

---

*Questions? Check the [main README](./README.md) or the [Deployment Guide](./docs/DEPLOYMENT.md)!*

