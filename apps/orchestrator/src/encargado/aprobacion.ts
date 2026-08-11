/**
 * 🧔 EL ENCARGADO — A3: la máquina de APROBACIÓN (el corazón del humano-en-el-loop).
 *
 * Un pedido pendiente a la vez, con expiración (2 min). El pedido se
 * construye con la info del muerto y se "olvida" si el Encargado se
 * reinicia (a propósito: un ✅ viejo no debe ejecutar lo que ya no se
 * quiere; se vuelve a pedir).
 *
 * Review 10/8 integrada: si un pedido nuevo reemplaza al anterior, se
 * AVISA ("Cancelé el pedido anterior...") — nunca reemplazo silencioso.
 *
 * v1.1 (10/8, pedido del fundador): además de los emojis ✅/❌, acepta
 * "si" / "sí" / "no" (más cómodo en el teléfono). Cualquier otra cosa
 * = mensaje honesto, el pedido sigue vigente.
 */

const EXPIRACION_MS = 2 * 60 * 1000; // 2 minutos

export interface Pedido {
  tipo: 'enterrar' | 'reintentar';
  dlqId: string;
  descripcion: string; // ej: "invoice.paid [network_timeout] · a1b2c3d4"
  expiraEn: number;
}

let pedido: Pedido | null = null;

/** Registra un pedido nuevo. Devuelve si canceló uno anterior (para avisar). */
export function proponer(
  tipo: Pedido['tipo'],
  dlqId: string,
  descripcion: string
): { avisoCancelado: string | null } {
  const anterior = pedido;
  pedido = { tipo, dlqId, descripcion, expiraEn: Date.now() + EXPIRACION_MS };
  const avisoCancelado = anterior
    ? `⚠️ Cancelé el pedido anterior (${anterior.descripcion}) — este es el nuevo.`
    : null;
  return { avisoCancelado };
}

/** El pedido vigente, o null (también lo limpia si venció). */
export function pedidoPendiente(): Pedido | null {
  if (!pedido) return null;
  if (Date.now() > pedido.expiraEn) {
    pedido = null;
    return null;
  }
  return pedido;
}

/**
 * Atiende la respuesta del fundador (✅/❌ o si/sí/no).
 * - ✅  → devuelve el pedido para EJECUTAR (y lo saca de la cola).
 * - ❌  → lo cancela (mensaje de no-hacer-nada).
 * - otra cosa → mensaje honesto, el pedido sigue vigente.
 */
export function responder(
  respuesta: string
): { accion: 'ejecutar' | 'cancelar' | 'nada'; pedido: Pedido | null; mensaje: string } {
  const actual = pedidoPendiente();
  if (!actual) return { accion: 'nada', pedido: null, mensaje: 'No tengo nada pendiente, jefe.' };
  const r = respuesta.trim().toLowerCase();
  if (r === '✅' || r === 'si' || r === 'sí') {
    pedido = null;
    return { accion: 'ejecutar', pedido: actual, mensaje: '' };
  }
  if (r === '❌' || r === 'no') {
    pedido = null;
    return { accion: 'cancelar', pedido: actual, mensaje: 'Nada que hacer, jefe — el muerto sigue en la mesa. 🤷' };
  }
  return {
    accion: 'nada',
    pedido: actual,
    mensaje: 'Solo entiendo si/no (o ✅/❌), jefe. El pedido sigue vigente (expira en 2 min).',
  };
}
