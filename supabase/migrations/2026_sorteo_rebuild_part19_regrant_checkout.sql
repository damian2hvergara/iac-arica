-- ============================================================
-- IAC ARICA 2026 — Parte 19
-- Re-otorga TODOS los permisos que "anon" necesita para comprar y
-- ver información pública, después de un error real en producción:
-- "permission denied for function create_pending_order" (42501) al
-- intentar pagar. Es el mismo tipo de problema que ya pasó antes
-- (ver parte 10) — GRANT que se pierde, no algo roto por cambios de
-- código. Este script es defensivo: reaplica TODOS los grants que el
-- sitio público necesita de una sola vez, incluyendo los de las
-- funciones agregadas después de la parte 10 (info_referido,
-- estado_orden_publico, top_referidores).
-- ============================================================

-- Tablas / vista de lectura pública
GRANT SELECT ON sorteo_publico TO anon;
GRANT SELECT ON packs_config TO anon;
GRANT SELECT ON vehicles TO anon, authenticated;
GRANT SELECT ON vehicle_images TO anon, authenticated;

-- Funciones que el checkout público necesita en cada compra
GRANT EXECUTE ON FUNCTION create_pending_order(text, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION confirmar_orden_simulado(uuid) TO anon;
GRANT EXECUTE ON FUNCTION stickers_vendidos_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION info_referido(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION estado_orden_publico(uuid) TO anon;
GRANT EXECUTE ON FUNCTION top_referidores(integer) TO anon, authenticated;

-- Panel admin (authenticated)
GRANT SELECT, INSERT, UPDATE, DELETE ON packs_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON sorteo_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ordenes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON estampillas TO authenticated;
GRANT EXECUTE ON FUNCTION confirmar_orden(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rechazar_orden(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION compradores_sin_referir() TO authenticated;

-- service_role (Edge Functions: Flow real, lookup-order, resend, etc.)
GRANT EXECUTE ON FUNCTION confirmar_orden(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION rechazar_orden(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION info_referido(text) TO service_role;

-- Por si PostgREST quedó con el caché de esquema desactualizado.
NOTIFY pgrst, 'reload schema';
