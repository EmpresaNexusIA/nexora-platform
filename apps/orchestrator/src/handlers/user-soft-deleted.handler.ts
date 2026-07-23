import { EventHandler } from './event-handler.interface.js';
import { OutboxEvent } from '../types/outbox.types.js';

export class UserSoftDeletedHandler implements EventHandler {
  async handle(event: OutboxEvent): Promise<void> {
    const { userId, tenantId } = event.payload;

    console.log(`[UserSoftDeletedHandler] Procesando baja lógica de usuario.`);
    console.log(` -> ID Usuario: ${userId}`);
    console.log(` -> ID Tenant: ${tenantId}`);
    console.log(` -> Request ID de origen: ${event.requestId}`);

    // TODO: Acá se inyectarán los servicios de negocio en el futuro
    // (Ej: Cancelar suscripciones, revocar tokens de acceso, enviar mails, etc.)
    
    await new Promise((resolve) => setTimeout(resolve, 100)); // Simulamos un delay asincrónico corto
  }
}
