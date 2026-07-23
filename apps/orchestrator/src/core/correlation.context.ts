import { randomUUID } from 'node:crypto';

export interface TraceContext {
  traceId: string;
  eventId: string;
  tenantId: string;
}

export class CorrelationContext {
  static generate(eventId: string, tenantId: string): TraceContext {
    return {
      traceId: randomUUID(),
      eventId,
      tenantId,
    };
  }
}
