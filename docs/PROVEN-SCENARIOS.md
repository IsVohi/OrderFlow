# OrderFlow Proven Scenarios

> Verified functionality vs designed-but-untested scenarios.
> Use this document for interview confidence.

---

## ✅ Implemented & Verified

These scenarios have been tested and work as expected.

### Saga Happy Path

| Step | Evidence |
|------|----------|
| Order creation | API creates order, status = CREATED |
| Event published | OrderCreated in Kafka verified |
| Inventory reservation | InventoryReserved event emitted |
| Payment capture | PaymentCaptured event emitted |
| Order fulfillment | Status = FULFILLED, audit log complete |

### Saga Compensation (Payment Failure)

| Step | Evidence |
|------|----------|
| Payment fails | PaymentFailed event with reason |
| Inventory compensates | InventoryReleased event emitted |
| Order cancelled | Status = CANCELLED |

### Transactional Outbox

| Scenario | Evidence |
|----------|----------|
| Event persisted with order | Same DB transaction |
| Background polling | Outbox job runs every 5s |
| Kafka publishing | Events appear in topic |
| Marker update | Outbox entries marked processed |

### Idempotent Consumers

| Scenario | Evidence |
|----------|----------|
| First message processed | Normal flow |
| Duplicate message skipped | No re-processing, log shows "already processed" |
| Message ID tracked | processed_messages table entry |

### Chaos Testing

| Scenario | Evidence |
|----------|----------|
| Payment failure injection | CHAOS_FAILURE_RATE triggers failures |
| Compensation triggered | InventoryReleased follows PaymentFailed |
| Dashboard reflects | Order shows CANCELLED status |

### Dashboard UI

| Scenario | Evidence |
|----------|----------|
| Role-based login | USER/SELLER/ADMIN get different views |
| Protected routes | Unauthenticated redirects to /login |
| Order list | Displays with search/filter |
| Order detail | Shows saga timeline events |
| Create order form | Submits and shows success |

---

## 🔶 Designed But Not Fully Tested

These scenarios are architecturally supported but haven't been stress-tested or run in production-like conditions.

| Scenario | Status | Notes |
|----------|--------|-------|
| Network partition recovery | Designed | Outbox should buffer, not tested under real partition |
| High-throughput (1000+ orders/min) | Not tested | Single dev instance only |
| Multi-partition Kafka | Designed | Works but not load tested |
| Service crash mid-saga | Designed | Idempotency should recover, needs chaos testing |
| Reservation timeout/expiry | Designed | TTL logic exists, not triggered in tests |
| Concurrent reservations | Designed | Row-level locking, not concurrency tested |

---

## ❌ Explicit Non-Goals

These are **not implemented by design**. Be prepared to explain why.

| Feature | Reason |
|---------|--------|
| Real payment gateway | Out of scope for system design demo |
| Production JWT validation | Mock auth for UI development speed |
| Kubernetes deployment | Docker Compose sufficient for demo |
| Database replication | Single instance per service |
| Rate limiting | Not a security demo |
| Event schema registry | JSON schema docs, no runtime registry |
| WebSocket real-time updates | Polling or manual refresh in UI |

---

## Interview Defense Notes

### "Why mock authentication?"

> The project focuses on distributed systems patterns, not authentication.
> Auth is solved by identity providers like Keycloak or Cognito.
> The role model is real and enforced; only the JWT generation is mocked.

### "Why no event sourcing?"

> We have an audit log for observability, but state is stored directly.
> Event sourcing adds complexity (projections, snapshots) that wasn't the focus.
> The architecture could support ES; it's a future-ready design.

### "How do you handle duplicate messages?"

> Idempotent consumers track processed message IDs in a dedicated table.
> Before processing, we check if the ID exists; if so, skip.
> This is done within the same transaction as the business operation.

### "What if Kafka goes down?"

> Transactional outbox persists events to the database first.
> Events are only published when Kafka is available.
> On recovery, the outbox job picks up where it left off.

### "Is this orchestration or choreography?"

> Choreography. No central coordinator.
> Each service listens for events and reacts independently.
> Order Service initiates but doesn't control the flow.

---

## Summary

| Category | Count |
|----------|-------|
| Verified scenarios | 6 major flows |
| Designed but untested | 6 edge cases |
| Explicit non-goals | 7 features |

**This document exists to build trust through honesty.**
