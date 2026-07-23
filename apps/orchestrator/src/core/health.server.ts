import { createServer, IncomingMessage, ServerResponse } from 'http';
import { Pool } from 'pg';
import { OutboxWorker } from './worker.js';
import { MetricsCollector } from './metrics.collector.js';

export class HealthServer {
  constructor(
    private readonly worker: OutboxWorker,
    private readonly dbPool: Pool,
    private readonly metrics: MetricsCollector,
    private readonly port: number = 8080
  ) {}

  /**
   * Inicializa el servidor HTTP nativo para el Health Check.
   */
  public start(): void {
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      // Solo respondemos al endpoint /health
      if (req.method === 'GET' && req.url === '/health') {
        let dbHealthy = false;
        
        try {
          // Validar conectividad real con la base de datos
          await this.dbPool.query('SELECT 1');
          dbHealthy = true;
        } catch (error) {
          console.error('[HealthCheck] Error de conectividad con la base de datos:', error);
        }

        const workerState = this.worker.getState();
        const isHealthy = dbHealthy && (workerState === 'RUNNING' || workerState === 'STARTING');

        const healthReport = {
          status: isHealthy ? 'UP' : 'DOWN',
          timestamp: new Date().toISOString(),
          components: {
            worker: {
              status: workerState,
              healthy: workerState === 'RUNNING' || workerState === 'STARTING'
            },
            database: {
              status: dbHealthy ? 'UP' : 'DOWN'
            }
          },
          metrics: this.metrics.getSnapshot()
        };

        res.writeHead(isHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(healthReport, null, 2));
        return;
      }

      // Cualquier otra ruta devuelve 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    });

    server.listen(this.port, () => {
      console.log(`[HealthServer] Servidor de Health Check escuchando en http://localhost:${this.port}/health`);
    });

    // Evitar que el servidor mantenga el proceso colgado al apagar el sistema
    server.unref();
  }
}
