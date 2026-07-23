export type ExecutionType =
  | "http"
  | "outbox"
  | "system";

export interface NexoraContext {
  readonly tenantId: string;
  readonly traceId: string;
  readonly correlationId: string;
  readonly executionType: ExecutionType;
}
