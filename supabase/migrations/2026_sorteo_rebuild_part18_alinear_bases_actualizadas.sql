-- ============================================================
-- IAC ARICA 2026 — Parte 18
-- Alinea la base de datos con la versión actualizada de las bases
-- legales notariadas (comparecencia 10-08-2026):
--
--   1. Precio piso de los packs: $4.000 → $4.500 por unidad
--      (cláusula Séptima).
--   2. Precio del Sticker Digital individual: $5.500 → $5.700
--      (cláusula Séptima). Solo se actualiza el pack "individual"
--      (1 unidad); los demás packs (duo, popular, etc.) hay que
--      revisarlos a mano en stamper-admin.html porque su precio por
--      unidad es una decisión comercial, no algo que se pueda
--      recalcular solo — únicamente deben seguir respetando el
--      nuevo piso de $4.500/unidad.
--   3. La "ventana de reembolso" deja de ser un campo que el admin
--      marca a mano y pasa a calcularse sola, tal como la define la
--      cláusula Octavo: abierta desde la 2ª prórroga
--      (extensiones_realizadas >= 2) Y mientras el Organizador no
--      haya confirmado que hará el sorteo igual sin meta (opción b
--      de la cláusula Octavo).
-- ============================================================

-- 1. Piso legal actualizado
ALTER TABLE packs_config DROP CONSTRAINT IF EXISTS precio_floor;
ALTER TABLE packs_config ADD CONSTRAINT precio_floor CHECK (precio_total >= cantidad_stickers * 4500);

-- 2. Precio individual actualizado
UPDATE packs_config SET precio_total = 5700 WHERE slug = 'individual' AND cantidad_stickers = 1;

-- 3. Ventana de reembolso automática (cláusula Octavo)
ALTER TABLE sorteo_config ADD COLUMN IF NOT EXISTS sorteo_confirmado_sin_meta boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW sorteo_publico AS
SELECT id, nombre_sorteo, descripcion, fecha_sorteo, fecha_venta_inicio, fecha_venta_cierre,
       vehicle_id, bases_url, activo, zona_franca_texto,
       (extensiones_realizadas >= 2 AND NOT sorteo_confirmado_sin_meta) AS ventana_reembolso_abierta,
       banco_nombre, banco_tipo_cuenta, banco_numero_cuenta, banco_rut_titular,
       banco_nombre_titular, banco_email, hero_imagen_url
FROM sorteo_config;
GRANT SELECT ON sorteo_publico TO anon;

-- Ahora que la vista ya no lee la columna real, se puede eliminar
-- (quedó reemplazada por el cálculo de arriba).
ALTER TABLE sorteo_config DROP COLUMN IF EXISTS ventana_reembolso_abierta;
