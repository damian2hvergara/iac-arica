-- ============================================================
-- IAC ARICA 2026 — Parte 4
-- Corrige "permission denied for table X": faltaban los GRANT base
-- de Postgres. Las políticas RLS (CREATE POLICY) solo controlan QUÉ
-- filas puede ver/tocar un rol — si el rol no tiene además el permiso
-- base sobre la tabla (GRANT SELECT/INSERT/UPDATE/DELETE), Postgres
-- bloquea antes de siquiera evaluar la política RLS.
-- Ejecutar después de las partes 1, 2 y 3, en Supabase → SQL Editor.
-- ============================================================

-- packs_config: lectura pública, escritura solo admin
GRANT SELECT ON packs_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON packs_config TO authenticated;

-- sorteo_config: solo admin (el público usa la vista sorteo_publico)
GRANT SELECT, INSERT, UPDATE, DELETE ON sorteo_config TO authenticated;

-- ordenes / estampillas: solo admin por tabla directa
-- (el público solo puede tocarlas a través de las funciones RPC
-- create_pending_order / confirmar_orden_simulado, que corren con
-- privilegios propios y no dependen de estos GRANT).
GRANT SELECT, INSERT, UPDATE, DELETE ON ordenes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON estampillas TO authenticated;

-- vehicles / vehicle_images: lectura pública (para el premio en
-- stamper.html), escritura solo admin (selector de vehículo +
-- admin.html ya existente)
GRANT SELECT ON vehicles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON vehicles TO authenticated;
GRANT SELECT ON vehicle_images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON vehicle_images TO authenticated;
