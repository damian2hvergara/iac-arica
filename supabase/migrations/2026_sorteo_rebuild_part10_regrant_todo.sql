-- ============================================================
-- IAC ARICA 2026 — Parte 10
-- Reafirma TODOS los permisos (GRANT) de una sola vez, porque han
-- ido apareciendo de a uno ("permission denied for table/function X").
-- Seguro de correr las veces que sea necesario, no rompe nada si un
-- permiso ya estaba puesto.
-- ============================================================

-- --- Funciones RPC públicas (anon) ---
GRANT EXECUTE ON FUNCTION create_pending_order(text, text, text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION confirmar_orden_simulado(uuid) TO anon;
GRANT EXECUTE ON FUNCTION stickers_vendidos_count(uuid) TO anon;

-- --- Funciones RPC solo-admin (authenticated) ---
GRANT EXECUTE ON FUNCTION confirmar_orden(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rechazar_orden(uuid, text) TO authenticated;

-- --- Vista pública ---
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON sorteo_publico TO anon;

-- --- Tablas ---
GRANT SELECT ON packs_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON packs_config TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON sorteo_config TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON ordenes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON estampillas TO authenticated;

GRANT SELECT ON vehicles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON vehicles TO authenticated;
GRANT SELECT ON vehicle_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON vehicle_images TO authenticated;

-- --- Verificación: lista todo lo que anon puede ejecutar/leer ---
SELECT routine_name AS objeto, 'FUNCTION' AS tipo, grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE grantee = 'anon'
UNION ALL
SELECT table_name, 'TABLE/VIEW', grantee, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
ORDER BY tipo, objeto;
