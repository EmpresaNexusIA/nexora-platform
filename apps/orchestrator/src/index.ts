import { EventDispatcher } from './core/event.dispatcher.js';
// ... otros imports existentes ...

const dispatcher = new EventDispatcher();

// Registro condicional para suite de validación
if (process.env.NODE_ENV === 'test') {
  console.log("[Testing] Registrando TestHandler para suite de validación");
}

// ... resto de tu inicialización ...
