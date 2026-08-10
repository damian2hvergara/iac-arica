-- ============================================================
-- IAC ARICA 2026 — Parte 11
-- Endurece permisos de anon: se encontraron GRANT de escritura
-- (INSERT/UPDATE/DELETE/TRUNCATE) sobre sorteo_config, vehicles,
-- vehicle_images, customization_kits y kit_features otorgados al rol
-- público (anon), que nunca debería poder escribir esas tablas
-- directamente. Hoy probablemente no es explotable porque RLS está
-- activo y las políticas solo permiten lectura, pero es mejor no
-- depender solo de RLS para esto — se revoca el permiso base también
-- (defensa en profundidad).
-- ============================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON sorteo_config FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON vehicles FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON vehicle_images FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON customization_kits FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON kit_features FROM anon;

-- Verificación 1: confirma que a anon le queda SOLO SELECT (o nada,
-- en el caso de sorteo_config) en estas tablas.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_name IN ('sorteo_config','vehicles','vehicle_images','customization_kits','kit_features')
ORDER BY table_name;

-- Verificación 2 (importante): confirma que RLS está realmente
-- ACTIVADO (relrowsecurity = true) en todas las tablas del sorteo.
-- Si alguna sale en "false", avísame porque ahí sí habría un problema real.
SELECT relname AS tabla, relrowsecurity AS rls_activado
FROM pg_class
WHERE relname IN ('sorteo_config','vehicles','vehicle_images','customization_kits',
                   'kit_features','ordenes','estampillas','packs_config')
ORDER BY relname;
