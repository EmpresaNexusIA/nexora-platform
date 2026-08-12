-- ============================================================
--  Migración 0004 — CRM del fundador: public.clientes 🗂️
--
--  El lugar blindado para guardar los datos de los clientes
--  (leads → vendidos → activos) que consigue el frente comercial.
--  Semilla del CRM de Nexora (dogfooding: lo usamos nosotros).
--
--  Qué trae:
--   1. Tabla public.clientes (ficha por negocio).
--   2. RLS ENABLE + FORCE (ADR-0008): candado de filas desde el
--      nacimiento — solo los roles de la casa la ven.
--   3. Grants para api_user (runtime futuro) DENTRO de la migración.
--   4. Índices por estado y por nombre.
--
--  Idempotente (IF NOT EXISTS), con statement-breakpoints.
--  Diseñada para la PRUEBA DE ORO: clon vacío + migraciones = maquinaria.
-- ============================================================

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.clientes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            text NOT NULL,
  rubro             text,
  direccion         text,
  telefono          text,
  tiene_web         boolean NOT NULL DEFAULT false,
  servicio_vendido  text
                    CHECK (servicio_vendido IN ('ninguno', 'web', 'bot', 'combo'))
                    DEFAULT 'ninguno',
  estado            text NOT NULL
                    CHECK (estado IN ('nuevo', 'contactado', 'presupuestando', 'vendido', 'activo'))
                    DEFAULT 'nuevo',
  notas             text,
  creado_en         timestamptz NOT NULL DEFAULT now(),
  actualizado_en    timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint
ALTER TABLE public.clientes FORCE ROW LEVEL SECURITY;

--> statement-breakpoint
CREATE POLICY clientes_nexora ON public.clientes
  FOR ALL
  TO nexora_admin, api_user
  USING (true)
  WITH CHECK (true);

--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON public.clientes TO api_user;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_clientes_estado ON public.clientes (estado);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON public.clientes (nombre);
