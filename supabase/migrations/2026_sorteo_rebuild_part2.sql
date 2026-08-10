-- ============================================================
-- IAC ARICA 2026 — Parte 2
-- Datos de transferencia bancaria editables desde el admin
-- (antes estaban como texto fijo "[completar]" en stamper.html).
-- Ejecutar después de 2026_sorteo_rebuild.sql, en Supabase → SQL Editor.
-- ============================================================

ALTER TABLE sorteo_config ADD COLUMN IF NOT EXISTS banco_nombre     text;
ALTER TABLE sorteo_config ADD COLUMN IF NOT EXISTS banco_tipo_cuenta text;
ALTER TABLE sorteo_config ADD COLUMN IF NOT EXISTS banco_numero_cuenta text;
ALTER TABLE sorteo_config ADD COLUMN IF NOT EXISTS banco_rut_titular text DEFAULT '78.375.615-3';
ALTER TABLE sorteo_config ADD COLUMN IF NOT EXISTS banco_nombre_titular text DEFAULT 'CV North Capital SpA';
ALTER TABLE sorteo_config ADD COLUMN IF NOT EXISTS banco_email text DEFAULT 'contacto@importamericancars.cl';

-- Vista pública: se agregan los datos bancarios (son de cara al comprador,
-- a diferencia de meta_minima_stickers/total_stickers_emitidos que nunca
-- deben quedar públicos).
CREATE OR REPLACE VIEW sorteo_publico AS
SELECT id, nombre_sorteo, descripcion, fecha_sorteo, fecha_venta_inicio, fecha_venta_cierre,
       vehicle_id, bases_url, activo, zona_franca_texto, ventana_reembolso_abierta,
       banco_nombre, banco_tipo_cuenta, banco_numero_cuenta, banco_rut_titular,
       banco_nombre_titular, banco_email
FROM sorteo_config;
GRANT SELECT ON sorteo_publico TO anon;

-- Completa aquí tus datos reales (ejemplo, ajusta con los tuyos):
-- UPDATE sorteo_config SET
--   banco_nombre = 'Banco Estado',
--   banco_tipo_cuenta = 'Cuenta Corriente',
--   banco_numero_cuenta = '00000000',
--   banco_rut_titular = '78.375.615-3',
--   banco_nombre_titular = 'CV North Capital SpA',
--   banco_email = 'contacto@importamericancars.cl'
-- WHERE activo = true;
