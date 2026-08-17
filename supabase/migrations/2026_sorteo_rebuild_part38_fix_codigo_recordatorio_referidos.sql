-- ============================================================
-- IAC ARICA 2026 — Parte 38
-- compradores_sin_referir() elegía el código a incluir en el correo
-- de recordatorio con array_agg(DISTINCT o.codigo_referido)[1] — sin
-- ORDER BY, ese orden no está garantizado. Mismo bug que se corrigió
-- en la parte 36 para mi_ranking_referidos: si la persona tiene más
-- de una orden completada (compra + sticker gratis por redes, o
-- compras repetidas), el recordatorio le podía mandar un código
-- distinto al que ya recibió en su correo de confirmación original,
-- fragmentando su link de referidos en dos.
--
-- Fix: se agrega mi_codigo, tomado explícitamente de la orden más
-- ANTIGUA de la persona (created_at ASC) — consistente con el mismo
-- criterio ya usado en mi_ranking_referidos. El array `codigos`
-- (todas las variantes, sin importar el orden) se mantiene tal cual
-- para el NOT EXISTS, que no depende de cuál vino primero.
-- ============================================================

CREATE OR REPLACE FUNCTION compradores_sin_referir()
RETURNS TABLE(nombre text, email text, codigo_referido text)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'no_autorizado'; END IF;
  RETURN QUERY
  WITH personas AS (
    SELECT
      lower(o.email)                                              AS email,
      (array_agg(o.nombre ORDER BY o.created_at DESC))[1]         AS nombre,
      (array_agg(o.codigo_referido ORDER BY o.created_at ASC))[1] AS mi_codigo,
      array_agg(DISTINCT o.codigo_referido)                       AS codigos,
      MIN(o.created_at)                                           AS primera_compra
    FROM ordenes o
    WHERE o.estado = 'completado'
    GROUP BY lower(o.email)
  )
  SELECT p.nombre, p.email, p.mi_codigo AS codigo_referido
  FROM personas p
  WHERE NOT EXISTS (
    SELECT 1 FROM ordenes r
    WHERE r.referido_por = ANY(p.codigos) AND r.estado = 'completado'
  )
  ORDER BY p.primera_compra ASC;
END;
$$;
REVOKE ALL ON FUNCTION compradores_sin_referir() FROM public;
GRANT EXECUTE ON FUNCTION compradores_sin_referir() TO authenticated;

NOTIFY pgrst, 'reload schema';
