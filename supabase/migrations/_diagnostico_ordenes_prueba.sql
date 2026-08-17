-- Diagnóstico: ver todas las órdenes de prueba creadas hasta ahora,
-- su estado, y cuántos folios (estampillas) tiene cada una.
-- Esto NO modifica nada, solo consulta.

SELECT
  o.id,
  o.nombre,
  o.email,
  o.estado,
  o.modo_pago,
  o.confirmado_por,
  o.created_at,
  o.confirmado_at,
  (SELECT COUNT(*) FROM estampillas e WHERE e.orden_id = o.id) AS cantidad_folios
FROM ordenes o
ORDER BY o.created_at ASC;
