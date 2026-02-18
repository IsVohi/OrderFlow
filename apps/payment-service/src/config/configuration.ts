export default () => ({
    port: parseInt(process.env.PORT || '3003', 10),
    environment: process.env.NODE_ENV || 'development',

    database: {
        url: process.env.DATABASE_URL,
    },

    kafka: {
        brokers: (process.env.KAFKA_BROKERS || '127.0.0.1:9092').split(','),
        clientId: process.env.KAFKA_CLIENT_ID || 'payment-service',
    },

    // Payment gateway configuration
    payment: {
        gateway: {
            failureRate: parseFloat(process.env.PAYMENT_GATEWAY_FAILURE_RATE || '0.0'),
            failureType: process.env.PAYMENT_GATEWAY_FAILURE_TYPE || 'card_declined',
            latencyMs: parseInt(process.env.PAYMENT_GATEWAY_LATENCY_MS || '0', 10),
            alwaysFailPrefix: process.env.PAYMENT_GATEWAY_ALWAYS_FAIL_PREFIX || '',
        },
    },

    // Chaos testing configuration
    chaos: {
        enabled: process.env.CHAOS_MODE_ENABLED === 'true',
        crashProbability: parseFloat(process.env.CHAOS_CRASH_PROBABILITY || '0.0'),
        latencyMs: parseInt(process.env.CHAOS_LATENCY_MS || '0', 10),
        kafkaProcessingDelayMs: parseInt(
            process.env.CHAOS_KAFKA_PROCESSING_DELAY_MS || '0',
            10,
        ),
        kafkaPauseProbability: parseFloat(
            process.env.CHAOS_KAFKA_PAUSE_PROBABILITY || '0.0',
        ),
        kafkaPauseDurationMs: parseInt(
            process.env.CHAOS_KAFKA_PAUSE_DURATION_MS || '0',
            10,
        ),
        dbFailureRate: parseFloat(process.env.CHAOS_DB_FAILURE_RATE || '0.0'),
        dbTimeoutMs: parseInt(process.env.CHAOS_DB_TIMEOUT_MS || '0', 10),
        paymentFailureRate: parseFloat(process.env.CHAOS_PAYMENT_FAILURE_RATE || '0.2'),
    },
});
