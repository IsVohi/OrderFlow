/**
 * Admin Audit Log Types
 * 
 * Records system-level actions taken by admins for accountability.
 * This is NOT for business data mutation (admins can't mutate orders).
 */

export type AuditAction =
    | 'CHAOS_ENABLED'
    | 'CHAOS_DISABLED'
    | 'CHAOS_CONFIG_CHANGED'
    | 'DLQ_MESSAGE_REPLAYED'
    | 'DLQ_MESSAGE_DISCARDED'
    | 'SERVICE_RESTARTED'
    | 'CONFIG_CHANGED'
    | 'MANUAL_METRIC_RESET';

export interface AuditLogEntry {
    id: string;
    adminId: string;
    adminEmail: string;
    action: AuditAction;
    target: {
        type: 'service' | 'order' | 'config' | 'dlq_message';
        id: string;
        name?: string;
    };
    metadata?: Record<string, unknown>;
    timestamp: Date;
    ipAddress?: string;
}

export interface AuditLogFilter {
    adminId?: string;
    action?: AuditAction;
    targetType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
}

/**
 * Dead Letter Queue Types
 */
export type DLQStatus = 'PENDING' | 'REPLAYED' | 'DISCARDED';

export interface DLQMessage {
    id: string;
    topic: string;
    originalTopic: string;
    partition: number;
    offset: number;
    key: string | null;
    value: Record<string, unknown>;
    headers: Record<string, string>;
    failureReason: string;
    failureCount: number;
    firstFailedAt: Date;
    lastFailedAt: Date;
    status: DLQStatus;
    replayedAt?: Date;
    replayedBy?: string;
}

export interface DLQStats {
    totalMessages: number;
    pendingMessages: number;
    replayedMessages: number;
    discardedMessages: number;
    byTopic: Record<string, number>;
}
