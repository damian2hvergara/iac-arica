-- Diagnóstico + fix para el 403 "permission denied for view sorteo_publico"
-- Corre esto completo en el SQL Editor de Supabase y pega el resultado
-- de la última consulta (la que empieza con SELECT grantee...).

-- 1. Confirmar que la vista existe
SELECT table_name FROM information_schema.views WHERE table_name = 'sorteo_publico';

-- 2. Volver a otorgar el permiso (por si el anterior no se aplicó)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON sorteo_publico TO anon, authenticated;

-- 3. Ver quién es el dueño de la vista (importante: debe ser postgres o
--    supabase_admin, un rol con acceso pleno a sorteo_config)
SELECT viewowner FROM pg_views WHERE viewname = 'sorteo_publico';

-- 4. Confirmar los permisos actuales sobre la vista
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'sorteo_publico';
