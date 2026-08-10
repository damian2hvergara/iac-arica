-- ============================================================
-- IAC ARICA 2026 — Parte 16
-- Funciones de apoyo para explotar el sistema de referidos:
--   1. top_referidores()      — ranking público, sin revelar cifras
--                                globales del sorteo (solo nombre +
--                                total referido de cada persona).
--   2. compradores_sin_referir() — admin-only, para la campaña de
--                                recordatorio a quienes no han
--                                compartido su link todavía.
-- ============================================================

-- Nombre + inicial del apellido (privacidad) y total de estampillas
-- que esa persona ha referido (pagadas, no bonus). Público porque no
-- expone nada del total emitido ni de la meta mínima.
CREATE OR REPLACE FUNCTION top_referidores(p_limit integer DEFAULT 5)
RETURNS TABLE(nombre_publico text, total_referido integer)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT
    trim(split_part(ref.nombre, ' ', 1)) || ' ' ||
      COALESCE(NULLIF(left(split_part(ref.nombre, ' ', 2), 1), ''), '') ||
      CASE WHEN NULLIF(split_part(ref.nombre, ' ', 2), '') IS NOT NULL THEN '.' ELSE '' END
      AS nombre_publico,
    SUM(o.cantidad_stickers)::integer AS total_referido
  FROM ordenes o
  JOIN ordenes ref ON ref.codigo_referido = o.referido_por
  WHERE o.estado = 'completado' AND o.referido_por IS NOT NULL
  GROUP BY ref.id, ref.nombre
  HAVING SUM(o.cantidad_stickers) > 0
  ORDER BY total_referido DESC
  LIMIT p_limit;
$$;
REVOKE ALL ON FUNCTION top_referidores(integer) FROM public;
GRANT EXECUTE ON FUNCTION top_referidores(integer) TO anon, authenticated;

-- Compradores con orden completada cuyo código de referido nunca ha
-- sido usado por nadie más (0 referidos exitosos) — para la campaña
-- de recordatorio "aún no has compartido tu link".
CREATE OR REPLACE FUNCTION compradores_sin_referir()
RETURNS TABLE(nombre text, email text, codigo_referido text)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT o.nombre, o.email, o.codigo_referido
  FROM ordenes o
  WHERE o.estado = 'completado'
    AND NOT EXISTS (
      SELECT 1 FROM ordenes r
      WHERE r.referido_por = o.codigo_referido AND r.estado = 'completado'
    )
  ORDER BY o.created_at ASC;
$$;
REVOKE ALL ON FUNCTION compradores_sin_referir() FROM public;
GRANT EXECUTE ON FUNCTION compradores_sin_referir() TO authenticated;
