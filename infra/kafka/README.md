# Kafka Topic Setup

## Quick Start

Create all topics at once:

```bash
./create-topics.sh
```

Or specify a custom broker:

```bash
KAFKA_BROKER=kafka:29092 ./create-topics.sh
```

## Topics Created

### Main Topics
- `orders` - Order lifecycle events (10 partitions, 7 day retention)
- `inventory` - Inventory reservation events (10 partitions, 7 day retention)
- `payments` - Payment transaction events (10 partitions, 30 day retention)

### Dead Letter Queues
- `orders.dlq` - Failed order events (3 partitions, 30 day retention)
- `inventory.dlq` - Failed inventory events (3 partitions, 30 day retention)
- `payments.dlq` - Failed payment events (3 partitions, 30 day retention)

## Configuration

All topics are created with:
- **min.insync.replicas**: 2 (ensures durability)
- **compression.type**: snappy (efficient compression)
- **cleanup.policy**: delete (time-based retention)

## Verifying Topics

List all topics:
```bash
kafka-topics.sh --list --bootstrap-server localhost:9092
```

Describe a specific topic:
```bash
kafka-topics.sh --describe --topic orders --bootstrap-server localhost:9092
```

## Deleting Topics (Development Only)

```bash
kafka-topics.sh --delete --topic orders --bootstrap-server localhost:9092
```

**⚠️ Warning**: Never delete topics in production!
