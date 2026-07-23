import { Logger } from '../src/core/logger.js';
import { OutboxWorker } from '../src/core/worker.js';

// Mock Processor con latencia
const mockProcessor = {
  process: async (evt: any) => {
    console.log('[MockProcessor] Procesando evento, tomará 2s...');
    await new Promise(r => setTimeout(r, 2000));
    console.log('[MockProcessor] Evento completado.');
  }
} as any;

async function runDrainTest() {
  const logger = new Logger();
  const worker = new OutboxWorker(logger, mockProcessor);

  console.log('--- Iniciando Prueba de Drenaje ---');
  
  // 1. Disparamos evento
  worker.handleEvent({ id: 'evt_drain_01', tenantId: 't1' });
  
  // 2. Esperamos 1s (el evento sigue activo)
  await new Promise(r => setTimeout(r, 1000));
  
  // 3. Solicitamos stop() mientras el evento se procesa
  console.log('[Test] Solicitando stop() mientras el evento está en curso...');
  await worker.stop();
  
  console.log('--- Prueba de Drenaje Finalizada ---');
}

runDrainTest();
