-- ============================================================
-- IAC ARICA 2026 — Parte 49
-- estado_orden_publico() no devolvía monto_total — hacía falta para
-- poder mandar el evento GA4 "purchase" con su `value` real cuando el
-- comprador vuelve a stamper.html por un redirect externo de Mercado
-- Pago (checkMpReturn(), stamper.html) y el JS no tiene en memoria los
-- datos de la orden. Sigue exponiendo lo mínimo: solo si se conoce el
-- UUID exacto de la orden (no es adivinable, no se lista nada por
-- email ni por rango) — mismo criterio que el resto de la función.
-- ============================================================

-- CREATE OR REPLACE no permite cambiar las columnas de salida (OUT
-- params) de una función existente — hay que borrarla primero.
DROP FUNCTION IF EXISTS estado_orden_publico(uuid);

CREATE FUNCTION estado_orden_publico(p_orden_id uuid)
RETURNS TABLE(estado text, cantidad_stickers integer, codigo_referido text, monto_total integer)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT o.estado, o.cantidad_stickers, o.codigo_referido, o.monto_total
  FROM ordenes o WHERE o.id = p_orden_id;
$$;
REVOKE ALL ON FUNCTION estado_orden_publico(uuid) FROM public;
GRANT EXECUTE ON FUNCTION estado_orden_publico(uuid) TO anon;

NOTIFY pgrst, 'reload schema';
