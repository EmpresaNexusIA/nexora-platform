// NEXORA · Notificaciones al VENDEDOR (server-only).
// Cadena de fallback:
//   1) NEXORA_EVENTS_URL → evento a tu orchestrator (outbox → Telegram) ✅ recomendado
//   2) NTFY_URL + comercio.ntfyTopic → POST directo a ntfy.sh
//   3) Sin nada configurado → no pasa nada (y no rompe el pedido)

import type { Comercio, Pedido, ItemPedido } from "./types";

export async function notificarPedidoNuevo(params: {
  pedido: Pedido;
  items?: ItemPedido[];
  tienda: Comercio;
}): Promise<void> {
  const { pedido, items, tienda } = params;
  const resumen = items?.length
    ? items.map((i) => `${i.cantidad}x ${i.nombreCongelado}`).join(", ").slice(0, 160)
    : `${pedido.numeroOrden}`;
  const titulo = `🛍️ Pedido nuevo ${pedido.numeroOrden} — $${pedido.totalFinal}`;
  const mensaje = `${tienda.nombre}: ${resumen}\nCliente: ${pedido.clienteNombre} (${pedido.clienteTelefono})\nPago: ${pedido.metodoPago} · ${pedido.modoEntrega}`;

  // 1 · Orchestrator de la plataforma (canal principal — usa TU outbox + Telegram)
  const eventsUrl = process.env.NEXORA_EVENTS_URL;
  if (eventsUrl) {
    try {
      await fetch(`${eventsUrl}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXORA_EVENTS_TOKEN || ""}`,
        },
        body: JSON.stringify({
          type: "pedido.creado",
          comercio_id: tienda.id,
          telegram_chat_id: tienda.telegramChatId ?? null,
          payload: { titulo, mensaje, pedido_id: pedido.id },
        }),
        signal: AbortSignal.timeout(4000),
      });
      return;
    } catch {
      // cae al fallback ntfy sin interrumpir el pedido
    }
  }

  // 2 · ntfy.sh directo (rápido de probar: topic por comercio)
  const ntfyBase = process.env.NTFY_URL || "https://ntfy.sh";
  if (tienda.ntfyTopic) {
    try {
      await fetch(`${ntfyBase}/${tienda.ntfyTopic}`, {
        method: "POST",
        headers: {
          Title: encodeURIComponent(titulo),
          Priority: "high",
          Tags: "money_with_wings",
        },
        body: mensaje,
        signal: AbortSignal.timeout(4000),
      });
    } catch {
      // silencio: las notificaciones nunca tiran el checkout abajo
    }
  }
}
