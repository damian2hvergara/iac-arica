-- ============================================================
-- IAC ARICA 2026 — Parte 48
-- Alinea el sistema con las bases legales actualizadas (comparecencia
-- 23-08-2026, documento "Bases_Legales_Sorteo_IAC_Arica_5_actualizado.pdf"):
--
--   1. La cláusula Octava deja de fijar un piso legal de $4.500/unidad
--      — el precio de cada pack queda íntegramente a criterio del
--      Organizador. Se elimina el CHECK precio_floor (agregado en la
--      parte 18); quedan vigentes los CHECK de base (cantidad_stickers
--      > 0, precio_total > 0), que no son un piso de precio sino una
--      validación de datos.
--   2. La venta se reinicia el 23 de agosto de 2026 (antes: 17-ago).
--      fecha_venta_inicio se actualiza en sorteo_config — ver también
--      el UPDATE manual pendiente de fecha_venta_cierre (30 días
--      corridos desde hoy = 22-sep-2026), que el usuario debe aplicar
--      vía el panel admin (Configuración Sorteo) o el UPDATE de abajo.
--
-- Todo lo demás de las bases (premio, Zona Franca, Meta Mínima,
-- sistema de referidos, ranking) es textualmente idéntico a la
-- versión anterior — no requiere cambios de esquema.
-- ============================================================

ALTER TABLE packs_config DROP CONSTRAINT IF EXISTS precio_floor;

UPDATE sorteo_config
SET fecha_venta_inicio = '2026-08-23',
    fecha_venta_cierre = '2026-09-22'
WHERE activo = true;

NOTIFY pgrst, 'reload schema';
