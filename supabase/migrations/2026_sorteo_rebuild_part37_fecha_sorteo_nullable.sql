-- ============================================================
-- IAC ARICA 2026 — Parte 37
-- fecha_sorteo debe quedar indeterminada (NULL) hasta que el
-- negocio decida y anuncie la fecha real (cláusula Décima: se
-- anuncia con ≥5 días de antelación, dentro de los 15 días
-- corridos después del cierre de venta, que además puede
-- prorrogarse). La columna tenía un NOT NULL heredado del diseño
-- original (cuando la fecha del sorteo se fijaba de entrada junto
-- con el resto de la config) que nunca se sacó — hay que quitarlo
-- antes de poder dejarla en NULL.
-- ============================================================

ALTER TABLE sorteo_config ALTER COLUMN fecha_sorteo DROP NOT NULL;

UPDATE sorteo_config SET fecha_sorteo = NULL WHERE activo = true;

NOTIFY pgrst, 'reload schema';
