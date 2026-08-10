-- ============================================================
-- IAC ARICA 2026 — Parte 15
-- Deja la base de datos lista para la integración real de Flow.cl
-- (código de las Edge Functions en supabase/functions/flow-create-payment
-- y supabase/functions/flow-webhook). NO activa nada todavía — mientras
-- FLOW_MODE siga en 'simulation' en stamper.html, todo esto queda sin
-- usarse y las compras de prueba siguen funcionando igual que ahora.
-- ============================================================

-- Guardamos el token/número de orden que Flow asigna, para poder
-- cruzar el webhook con la orden correcta.
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS flow_token text;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS flow_order text;

-- El webhook de Flow corre en una Edge Function que usa la
-- service_role key (no anon, no authenticated) para poder confirmar
-- órdenes y leer lo necesario sin depender de sesión de usuario.
GRANT EXECUTE ON FUNCTION confirmar_orden(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION rechazar_orden(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION info_referido(text) TO service_role;
GRANT SELECT, UPDATE ON ordenes TO service_role;
GRANT SELECT ON estampillas TO service_role;
GRANT SELECT ON sorteo_config TO service_role;
GRANT SELECT ON packs_config TO service_role;
GRANT SELECT ON vehicles TO service_role;
GRANT SELECT ON vehicle_images TO service_role;

-- ------------------------------------------------------------
-- estado_orden_publico — para la pantalla "verificando tu pago" cuando
-- el comprador vuelve desde Flow. Solo expone lo mínimo (estado,
-- cantidad, código de referido) y solo si se conoce el UUID exacto de
-- la orden (no es adivinable, no se lista nada por email ni por rango).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION estado_orden_publico(p_orden_id uuid)
RETURNS TABLE(estado text, cantidad_stickers integer, codigo_referido text)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT o.estado, o.cantidad_stickers, o.codigo_referido
  FROM ordenes o WHERE o.id = p_orden_id;
$$;
REVOKE ALL ON FUNCTION estado_orden_publico(uuid) FROM public;
GRANT EXECUTE ON FUNCTION estado_orden_publico(uuid) TO anon;
