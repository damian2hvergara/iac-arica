-- ============================================================
-- IAC ARICA 2026 — Parte 17
-- Imagen de portada del hero, configurable desde el admin (se sube a
-- Cloudinary igual que las fotos de vehículos, y se guarda la URL
-- acá). Si se deja vacía, stamper.html sigue usando la primera foto
-- del vehículo como respaldo.
-- ============================================================

ALTER TABLE sorteo_config ADD COLUMN IF NOT EXISTS hero_imagen_url text;

CREATE OR REPLACE VIEW sorteo_publico AS
SELECT id, nombre_sorteo, descripcion, fecha_sorteo, fecha_venta_inicio, fecha_venta_cierre,
       vehicle_id, bases_url, activo, zona_franca_texto, ventana_reembolso_abierta,
       banco_nombre, banco_tipo_cuenta, banco_numero_cuenta, banco_rut_titular,
       banco_nombre_titular, banco_email, hero_imagen_url
FROM sorteo_config;
GRANT SELECT ON sorteo_publico TO anon;
