export interface EventMetadata {
    eventId: string;
    eventType: string;
    eventVersion: string;
    timestamp: string;
    correlationId: string;
    causationId: string | null;
    traceId?: string;
    spanId?: string;
}


export interface ExtendedEventMetadata extends EventMetadata {
    source: {
        service: string;
        version: string;
        instance: string;
    };
}

export interface BaseEvent<T = unknown> {
    metadata: EventMetadata;
    payload: T;
}

