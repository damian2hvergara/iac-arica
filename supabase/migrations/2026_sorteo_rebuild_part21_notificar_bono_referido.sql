-- ============================================================
-- IAC ARICA 2026 — Parte 21
-- Hasta ahora, cuando alguien gana una estampilla de regalo por
-- referidos (cada 4 amigos que compran con su código), la estampilla
-- se crea en la base de datos pero NUNCA se avisa por correo con su
-- folio real — el referente solo recibía un correo de "vas
-- avanzando" sin la estampilla en sí. Esto agrega el mecanismo para
-- poder mandarle esa estampilla como corresponde.
--
-- 1. Columna "notificado" en estampillas: para saber qué bonos ya se
--    avisaron por correo y no reenviar el mismo dos veces.
-- 2. Función bonos_pendientes_notificacion(orden_id): dado el id de
--    la orden de un AMIGO recién confirmada, si esa compra generó
--    (en algún momento) estampillas de bono para su referente que
--    todavía no se avisaron, las devuelve y las marca como avisadas
--    en la misma operación (UPDATE ... RETURNING, atómico).
-- ============================================================

ALTER TABLE estampillas ADD COLUMN IF NOT EXISTS notificado boolean NOT NULL DEFAULT false;

-- Las estampillas normales (no bono) no necesitan este mecanismo —
-- se marcan como ya "notificadas" para que no aparezcan nunca en
-- bonos_pendientes_notificacion por error.
UPDATE estampillas SET notificado = true WHERE es_bonus = false;

CREATE OR REPLACE FUNCTION bonos_pendientes_notificacion(p_orden_id uuid)
RETURNS TABLE(
  numero_folio     text,
  hash_seguridad   text,
  referente_email  text,
  referente_nombre text,
  referente_codigo text
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orden     ordenes%ROWTYPE;
  v_ref_orden ordenes%ROWTYPE;
BEGIN
  SELECT * INTO v_orden FROM ordenes o WHERE o.id = p_orden_id;
  IF NOT FOUND OR v_orden.referido_por IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_ref_orden FROM ordenes o
  WHERE o.codigo_referido = v_orden.referido_por AND o.estado = 'completado';
  IF NOT FOUND THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE estampillas e
  SET notificado = true
  WHERE e.orden_id = v_ref_orden.id AND e.es_bonus = true AND e.notificado = false
  RETURNING e.numero_folio, e.hash_seguridad, v_ref_orden.email, v_ref_orden.nombre, v_ref_orden.codigo_referido;
END;
$$;
REVOKE ALL ON FUNCTION bonos_pendientes_notificacion(uuid) FROM public;
GRANT EXECUTE ON FUNCTION bonos_pendientes_notificacion(uuid) TO anon, service_role;
