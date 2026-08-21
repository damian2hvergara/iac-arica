-- ============================================================
-- IAC ARICA 2026 — Parte 45
-- Ranking de Referenciadores para el panel admin (cláusula Décimo
-- Séptima de las bases legales: los 3 que más Compras Referidas
-- acumulen ganan $300.000 / $150.000 / $50.000 en efectivo).
--
-- top_referidores() (parte 16) NO sirve para determinar ganadores
-- reales: agrupa por ref.id (una fila por ORDEN, no por persona), y
-- desde que la parte 35 hace que cada bono por referido cree una
-- orden nueva con su propio codigo_referido, una misma persona con
-- 2+ códigos queda fragmentada en 2+ filas del ranking — podría
-- mostrarla más abajo de donde realmente está, con dinero real de
-- por medio. mi_ranking_referidos() (parte 36) ya resuelve esto para
-- la propia persona sumando todos sus v_codigos; acá se generaliza
-- ese mismo criterio para TODOS a la vez, agrupando por persona
-- (email + rut normalizados), no por código individual.
--
-- Desempate (cláusula 17.e): gana quien alcanzó su total primero. El
-- total final de una persona se alcanza en el momento de su última
-- Compra Referida (después de esa fecha su total ya no cambió), así
-- que ordenar por MAX(created_at) ascendente entre empatados replica
-- exactamente esa regla sin necesitar un historial aparte.
-- ============================================================

CREATE OR REPLACE FUNCTION ranking_referenciadores_admin(p_limit integer DEFAULT NULL)
RETURNS TABLE(
  posicion         integer,
  nombre           text,
  email            text,
  telefono         text,
  rut_pasaporte    text,
  mi_codigo        text,
  total_referido   integer,
  ultima_referida  timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'no_autorizado'; END IF;
  RETURN QUERY
  WITH personas AS (
    SELECT
      lower(o.email)                                                    AS email_norm,
      normalizar_rut_pasaporte(o.rut_pasaporte)                         AS rut_norm,
      (array_agg(o.nombre ORDER BY o.created_at DESC))[1]               AS nombre,
      (array_agg(o.email ORDER BY o.created_at DESC))[1]                AS email,
      (array_agg(o.telefono ORDER BY o.created_at DESC))[1]             AS telefono,
      (array_agg(o.rut_pasaporte ORDER BY o.created_at DESC))[1]        AS rut_pasaporte,
      (array_agg(o.codigo_referido ORDER BY o.created_at ASC))[1]       AS mi_codigo,
      array_agg(DISTINCT o.codigo_referido)                             AS codigos
    FROM ordenes o
    WHERE o.estado = 'completado'
    GROUP BY lower(o.email), normalizar_rut_pasaporte(o.rut_pasaporte)
  ),
  referidas AS (
    SELECT
      p.email_norm, p.rut_norm,
      SUM(o.cantidad_stickers)::integer AS total,
      MAX(o.created_at)                 AS ultima
    FROM personas p
    JOIN ordenes o ON o.referido_por = ANY(p.codigos) AND o.estado = 'completado'
    GROUP BY p.email_norm, p.rut_norm
    HAVING SUM(o.cantidad_stickers) > 0
  )
  SELECT
    RANK() OVER (ORDER BY rf.total DESC, rf.ultima ASC)::integer AS posicion,
    p.nombre, p.email, p.telefono, p.rut_pasaporte, p.mi_codigo,
    rf.total, rf.ultima
  FROM referidas rf
  JOIN personas p ON p.email_norm = rf.email_norm AND p.rut_norm = rf.rut_norm
  ORDER BY rf.total DESC, rf.ultima ASC
  LIMIT COALESCE(p_limit, 2147483647);
END;
$$;
REVOKE ALL ON FUNCTION ranking_referenciadores_admin(integer) FROM public;
GRANT EXECUTE ON FUNCTION ranking_referenciadores_admin(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
