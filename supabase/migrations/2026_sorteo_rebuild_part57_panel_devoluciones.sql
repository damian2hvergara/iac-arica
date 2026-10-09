-- ============================================================
-- IAC ARICA 2026 — Parte 57
-- Esquema para el panel interno de control de devoluciones
-- (devoluciones.html) — las devoluciones en sí se ejecutan a mano en
-- el panel de Mercado Pago; esto solo lleva el registro. No toca
-- ninguna fila existente de "ordenes".
--
-- Dos tablas, dos granularidades distintas a propósito:
--   - devolucion_tracking: una fila por ORDEN (los reembolsos en MP son
--     por pago, y cada orden = un pago).
--   - aviso_devolucion_email: una fila por PERSONA (email normalizado —
--     el correo de aviso es uno por comprador aunque tenga varias
--     órdenes, mismo criterio de agrupación que compradores_sin_referir/
--     ranking_referenciadores_admin, ver 03-Modelo-Datos/ordenes-y-estampillas.md).
--
-- Mismo patrón de RLS que costos/socios (parte 53/54): la política de
-- RLS por sí sola no alcanza, hace falta además el GRANT de tabla
-- explícito a "authenticated" — lección ya aprendida en este proyecto.
-- ============================================================

-- ── 1. devolucion_tracking (una fila por orden, creada al editar) ───
CREATE TABLE IF NOT EXISTS devolucion_tracking (
  orden_id          uuid PRIMARY KEY REFERENCES ordenes(id),
  estado            text NOT NULL DEFAULT 'pendiente'
                     CHECK (estado IN ('pendiente', 'devuelta', 'con_problema')),
  fecha_devolucion  date,
  numero_operacion_mp text,
  notas             text,
  actualizado_por   text,
  actualizado_at    timestamptz NOT NULL DEFAULT now()
);

-- "Historial simple": quién hizo el último cambio y cuándo, server-side
-- siempre — ignora lo que mande el cliente en esos dos campos, mismo
-- criterio que ordenes.confirmado_por/confirmado_at en el resto del
-- proyecto. Si en algún momento se necesita el historial de CADA
-- cambio (no solo el último), esto habría que cambiarlo por una tabla
-- de eventos aparte.
CREATE OR REPLACE FUNCTION devolucion_tracking_set_actor()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.actualizado_por := auth.email();
  NEW.actualizado_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devolucion_tracking_actor ON devolucion_tracking;
CREATE TRIGGER trg_devolucion_tracking_actor
  BEFORE INSERT OR UPDATE ON devolucion_tracking
  FOR EACH ROW EXECUTE FUNCTION devolucion_tracking_set_actor();

ALTER TABLE devolucion_tracking ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON devolucion_tracking FROM anon;
GRANT SELECT, INSERT, UPDATE ON devolucion_tracking TO authenticated;

DROP POLICY IF EXISTS devolucion_tracking_admin_select ON devolucion_tracking;
CREATE POLICY devolucion_tracking_admin_select ON devolucion_tracking
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS devolucion_tracking_admin_write ON devolucion_tracking;
CREATE POLICY devolucion_tracking_admin_write ON devolucion_tracking
  FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS devolucion_tracking_admin_update ON devolucion_tracking;
CREATE POLICY devolucion_tracking_admin_update ON devolucion_tracking
  FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ── 2. aviso_devolucion_email (una fila por persona) ─────────────────
CREATE TABLE IF NOT EXISTS aviso_devolucion_email (
  email       text PRIMARY KEY,
  estado      text NOT NULL DEFAULT 'no_enviado'
              CHECK (estado IN ('no_enviado', 'enviado', 'fallo')),
  enviado_at  timestamptz,
  error       text
);

ALTER TABLE aviso_devolucion_email ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON aviso_devolucion_email FROM anon;
-- Solo lectura para el panel admin — la escritura la hace la Edge
-- Function send-refund-notice con la service role key, nunca el
-- cliente directo (evita que alguien marque "enviado" sin que se haya
-- mandado nada).
GRANT SELECT ON aviso_devolucion_email TO authenticated;

DROP POLICY IF EXISTS aviso_devolucion_email_admin_select ON aviso_devolucion_email;
CREATE POLICY aviso_devolucion_email_admin_select ON aviso_devolucion_email
  FOR SELECT TO authenticated USING (is_admin());

NOTIFY pgrst, 'reload schema';
