-- ============================================================
-- IAC ARICA 2026 — Parte 9
-- Fix: 403 al consultar sorteo_publico desde stamper.html (anon).
-- Reafirma el GRANT que debería existir desde la parte 1/2 — por
-- algún motivo el rol anon no lo tiene, así que stamper.html no puede
-- leer el sorteo activo y muestra "el sorteo aún no está configurado".
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON sorteo_publico TO anon;

-- Verificación: esto debe devolver una fila con "anon" listado en
-- grantee para sorteo_publico. Si sale vacío, el GRANT de arriba no
-- se aplicó y hay que revisar permisos a nivel de rol en el dashboard.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'sorteo_publico';
