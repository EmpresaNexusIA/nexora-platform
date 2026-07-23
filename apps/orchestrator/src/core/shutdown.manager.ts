import { OutboxWorker } from './worker.js';
import { Pool } from 'pg';

export class ShutdownManager {
  private isShuttingDown = false;

  constructor(
    private readonly worker: OutboxWorker,
    private readonly dbPool: Pool
  ) {}

  public listen(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

    for (const signal of signals) {
      process.on(signal, async () => {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        console.log(`\n[Shutdown] Señal ${signal} recibida. Iniciando Graceful Shutdown...`);

        try {
          // 1. Delegamos el drenaje de jobs activos al Worker
          await this.worker.stop();
          console.log('[Shutdown] Worker detenido correctamente.');

          // 2. Cerramos el pool de conexiones de la Base de Datos
          console.log('[Shutdown] Cerrando pool de conexiones de PostgreSQL...');
          await this.dbPool.end();

          console.log('[Shutdown] Nexora Orchestrator se apagó de forma segura. Éxito.');
          process.exit(0);
        } catch (error) {
          console.error('[Shutdown] Error crítico durante el apagado elegante:', error);
          process.exit(1);
        }
      });
    }
  }
}
