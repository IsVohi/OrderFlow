#!/bin/bash

# Kafka Topic Creation Script for OrderFlow
# This script creates all required Kafka topics with proper partitioning and replication

set -e

KAFKA_BROKER="${KAFKA_BROKER:-localhost:9092}"
RETENTION_7_DAYS=604800000   # 7 days in milliseconds
RETENTION_30_DAYS=2592000000 # 30 days in milliseconds

echo "========================================="
echo "OrderFlow Kafka Topic Setup"
echo "========================================="
echo "Broker: $KAFKA_BROKER"
echo ""

# Function to create topic
create_topic() {
  local topic=$1
  local partitions=$2
  local replication=$3
  local retention=$4
  
  echo "Creating topic: $topic"
  echo "  - Partitions: $partitions"
  echo "  - Replication Factor: $replication"
  echo "  - Retention: $retention ms"
  
  kafka-topics.sh --create \
    --bootstrap-server "$KAFKA_BROKER" \
    --topic "$topic" \
    --partitions "$partitions" \
    --replication-factor "$replication" \
    --config retention.ms="$retention" \
    --config min.insync.replicas=2 \
    --config compression.type=snappy \
    --config cleanup.policy=delete \
    --if-not-exists
    
  echo "✓ Topic $topic created successfully"
  echo ""
}

# Main Topics
echo "Creating main event topics..."
create_topic "orders" 10 3 "$RETENTION_7_DAYS"
create_topic "inventory" 10 3 "$RETENTION_7_DAYS"
create_topic "payments" 10 3 "$RETENTION_30_DAYS"

# Dead Letter Queue Topics
echo "Creating dead letter queue topics..."
create_topic "orders.dlq" 3 3 "$RETENTION_30_DAYS"
create_topic "inventory.dlq" 3 3 "$RETENTION_30_DAYS"
create_topic "payments.dlq" 3 3 "$RETENTION_30_DAYS"

echo "========================================="
echo "Topic Creation Complete"
echo "========================================="
echo ""

# List all topics
echo "Verifying topics..."
kafka-topics.sh --list --bootstrap-server "$KAFKA_BROKER" | grep -E "orders|inventory|payments"

echo ""
echo "Setup complete! ✓"
