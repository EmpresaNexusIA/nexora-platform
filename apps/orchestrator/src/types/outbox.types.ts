export type OutboxStatus = 
  | 'PENDING' 
  | 'PROCESSING' 
  | 'COMPLETED' 
  | 'RETRY' 
  | 'FAILED' 
  | 'DEAD_LETTER';

export interface OutboxEvent {
  id: string;
  status: OutboxStatus;
  eventType: string;
  payload: Record<string, any>;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: Date | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  errorLog: string | null;
  requestId: string | null;
}
