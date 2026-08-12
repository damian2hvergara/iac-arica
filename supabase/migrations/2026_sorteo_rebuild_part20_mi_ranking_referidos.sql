-- ============================================================
-- IAC ARICA 2026 — Parte 20
-- Panel privado "Mi ranking de referidos": el propio referenciador
-- entra con su correo + RUT/pasaporte (los mismos datos con que
-- compró) y ve, en tiempo real:
--   - Cuántos amigos han comprado con su código y cuántos stickers
--     de bono ya ganó / le faltan para el próximo.
--   - Su posición exacta en el ranking completo (no solo si está en
--     el Top 5/20 público).
--   - Qué tan lejos está del podio (Top 3, que gana dinero según la
--     cláusula Décimo Sexta) — el dato clave para generar urgencia.
--
-- Requiere correo + RUT/pasaporte juntos (no alcanza con adivinar un
-- correo) porque esta info es más sensible que "mis stickers": expone
-- cuánta gente refirió cada persona en comparación con las demás.
-- ============================================================

CREATE OR REPLACE FUNCTION mi_ranking_referidos(p_email text, p_rut_pasaporte text)
RETURNS TABLE(
  mi_codigo_referido      text,
  mi_total_referido       integer,
  mi_bonos_ganados        integer,
  mi_faltan_proximo_bono  integer,
  mi_posicion             integer,
  total_referenciadores   integer,
  ya_esta_en_top3         boolean,
  faltan_para_top3        integer,
  umbral_top3             integer
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
  v_email     text := lower(trim(p_email));
  v_rut       text := upper(regexp_replace(trim(p_rut_pasaporte), '[.[:space:]]', '', 'g'));
  v_codigos   text[];
  v_mi_codigo text;
BEGIN
  SELECT array_agg(DISTINCT o.codigo_referido) INTO v_codigos
  FROM ordenes o
  WHERE lower(o.email) = v_email
    AND upper(regexp_replace(o.rut_pasaporte, '[.[:space:]]', '', 'g')) = v_rut
    AND o.estado = 'completado';

  IF v_codigos IS NULL OR array_length(v_codigos, 1) = 0 THEN
    RAISE EXCEPTION 'no_encontrado';
  END IF;

  SELECT o.codigo_referido INTO v_mi_codigo
  FROM ordenes o
  WHERE lower(o.email) = v_email
    AND upper(regexp_replace(o.rut_pasaporte, '[.[:space:]]', '', 'g')) = v_rut
    AND o.estado = 'completado'
  ORDER BY o.created_at DESC
  LIMIT 1;

  RETURN QUERY
  WITH ranking AS (
    SELECT ref.codigo_referido AS codigo, SUM(o.cantidad_stickers)::integer AS total
    FROM ordenes o
    JOIN ordenes ref ON ref.codigo_referido = o.referido_por
    WHERE o.estado = 'completado' AND o.referido_por IS NOT NULL
    GROUP BY ref.codigo_referido
    HAVING SUM(o.cantidad_stickers) > 0
  ),
  mi AS (
    SELECT COALESCE(SUM(total), 0)::integer AS total
    FROM ranking WHERE codigo = ANY(v_codigos)
  ),
  top3 AS (
    SELECT COALESCE(MIN(total), 0)::integer AS umbral
    FROM (SELECT total FROM ranking ORDER BY total DESC LIMIT 3) t
  )
  SELECT
    v_mi_codigo,
    mi.total,
    (mi.total / 4),
    (4 - (mi.total % 4)),
    ((SELECT COUNT(*)::integer FROM ranking r WHERE r.total > mi.total) + 1),
    (SELECT COUNT(*)::integer FROM ranking),
    (mi.total > 0 AND mi.total >= top3.umbral),
    GREATEST(0, top3.umbral - mi.total),
    top3.umbral
  FROM mi, top3;
END;
$$;
REVOKE ALL ON FUNCTION mi_ranking_referidos(text, text) FROM public;
GRANT EXECUTE ON FUNCTION mi_ranking_referidos(text, text) TO anon;
