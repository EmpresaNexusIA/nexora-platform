export interface MetricsSnapshot {
  processed: number;
  success: number;
  failure: number;
  retry: number;
  deadLetter: number;
}

export class MetricsCollector {
  private counters: MetricsSnapshot = {
    processed: 0,
    success: 0,
    failure: 0,
    retry: 0,
    deadLetter: 0,
  };

  incrementProcessed(): void {
    this.counters.processed++;
  }

  incrementSuccess(): void {
    this.counters.success++;
  }

  incrementFailure(): void {
    this.counters.failure++;
  }

  incrementRetry(): void {
    this.counters.retry++;
  }

  recordDeadLetter(): void {
    this.counters.deadLetter++;
  }

  getSnapshot(): MetricsSnapshot {
    return {
      processed: this.counters.processed,
      success: this.counters.success,
      failure: this.counters.failure,
      retry: this.counters.retry,
      deadLetter: this.counters.deadLetter,
    };
  }
}
