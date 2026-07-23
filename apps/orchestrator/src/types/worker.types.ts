export type WorkerState = 'STOPPED' | 'STARTING' | 'RUNNING' | 'STOPPING';

export interface WorkerConfig {
  batchSize: number;
  intervalMs: number;
}
