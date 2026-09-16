import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "@nexora/database";

// ============================================================
//  POST /crm/leads — Captación pública desde la landing de tienda
//  Escribe en crm/clientes (estado 'nuevo', servicio 'ninguno').
//  Anti-spam: honeypot + rate-limit por IP (config en index).
// ============================================================

const leadSchema = z.object({
  nombre: z.string().trim().min(2, "Nombre muy corto").max(120),
  telefono: z
    .string()
    .trim()
    .transform((s) => s.replace(/\D/g, ""))
    .pipe(z.string().min(8, "Revisá el teléfono").max(20)),
  rubro: z.string().trim().max(120).optional().default(""),
  tieneWeb: z.boolean().optional().default(false),
  notas: z.string().trim().max(500).optional().default(""),
  // 🍯 honeypot: los bots lo completan, los humanos no lo ven
  empresa: z.string().max(0).optional(),
});

export async function leadsPlugin(app: FastifyInstance) {
  app.post(
    "/crm/leads",
    {
      config: { rateLimit: { max: 5, timeWindow: "1 minute" } },
      schema: {
        tags: ["CRM"],
        summary: "Alta pública de lead (desde la landing de tienda)",
      },
    },
    async (request, reply) => {
      // Honeypot: si viene lleno, fingimos éxito y no guardamos nada
      const raw = request.body as Record<string, unknown>;
      if (typeof raw?.empresa === "string" && raw.empresa.trim() !== "") {
        request.log.info({ event: "lead_honeypot" }, "Honeypot activado");
        return reply.code(202).send({ ok: true });
      }

      const parsed = leadSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: parsed.error.issues[0]?.message || "Datos inválidos",
        });
      }
      const { nombre, telefono, rubro, tieneWeb, notas } = parsed.data;

      try {
        await pool.query(
          `INSERT INTO public.clientes (nombre, rubro, telefono, tiene_web, notas, estado, servicio_vendido)
           VALUES ($1, $2, $3, $4, $5, 'nuevo', 'ninguno')`,
          [nombre, rubro || null, telefono, tieneWeb, notas],
        );
        request.log.info({ event: "lead_creado", rubro }, "Lead nuevo desde landing");
        return reply.code(201).send({ ok: true });
      } catch (err) {
        request.log.error({ err }, "Fallo insertando lead en crm/clientes");
        return reply.code(500).send({ error: "No pudimos registrar tu pedido. Probá de nuevo." });
      }
    },
  );
}
