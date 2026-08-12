-- ============================================================
-- IAC ARICA 2026 — Parte 23
-- "188539351" y "18853935-1" son el mismo RUT, pero al guardarse tal
-- cual como los tipeó cada comprador, mi_ranking_referidos los trataba
-- como dos identidades distintas (contaba referidos por separado y
-- hasta generaba una posición de ranking diferente para cada una).
--
-- normalizar_rut_pasaporte(valor): si lo que queda al sacar puntos,
-- espacios y guion es puro número (+ opcional K de verificador) —es
-- decir, tiene forma de RUT chileno, nunca empieza con letras como un
-- pasaporte—, lo devuelve siempre en el mismo formato "XX.XXX.XXX-X".
-- Si no, lo trata como pasaporte y solo lo limpia/normaliza a mayúsculas.
--
-- Se usa en dos puntos:
--   1. create_pending_order: guarda el RUT ya normalizado desde el
--      principio, para que quede consistente en toda compra nueva.
--   2. mi_ranking_referidos: compara usando la misma normalización,
--      así compras viejas con formatos distintos igual calzan.
-- ============================================================

CREATE OR REPLACE FUNCTION normalizar_rut_pasaporte(p_valor text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_clean text;
  v_body  text;
  v_dv    text;
BEGIN
  v_clean := upper(regexp_replace(trim(p_valor), '[.[:space:]-]', '', 'g'));
  IF v_clean ~ '^[0-9]{7,8}[0-9K]$' THEN
    v_body := left(v_clean, length(v_clean) - 1);
    v_dv := right(v_clean, 1);
    RETURN reverse(regexp_replace(reverse(v_body), '([0-9]{3})(?=[0-9])', '\1.', 'g')) || '-' || v_dv;
  ELSE
    RETURN v_clean;
  END IF;
END;
$$;

-- 1. Guardar siempre el RUT ya normalizado en compras nuevas
CREATE OR REPLACE FUNCTION create_pending_order(
  p_nombre text, p_email text, p_telefono text, p_rut_pasaporte text,
  p_pack_slug text, p_referido_por text DEFAULT NULL
) RETURNS TABLE(orden_id uuid, referencia text, monto_total integer, cantidad_stickers integer, codigo_referido text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pack   packs_config;
  v_sorteo sorteo_config;
  v_id     uuid;
  v_ref    text;
  v_codigo text;
BEGIN
  IF p_nombre IS NULL OR length(trim(p_nombre)) < 3 THEN RAISE EXCEPTION 'nombre_invalido'; END IF;
  IF p_email IS NULL OR p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'email_invalido'; END IF;
  IF p_telefono IS NULL OR length(trim(p_telefono)) < 8 THEN RAISE EXCEPTION 'telefono_invalido'; END IF;
  IF p_rut_pasaporte IS NULL OR length(trim(p_rut_pasaporte)) < 5 THEN RAISE EXCEPTION 'rut_invalido'; END IF;

  SELECT * INTO v_pack FROM packs_config WHERE slug = p_pack_slug AND activo = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'pack_invalido'; END IF;

  SELECT * INTO v_sorteo FROM sorteo_config WHERE activo = true LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'sorteo_no_activo'; END IF;

  IF p_referido_por IS NOT NULL AND NOT EXISTS
     (SELECT 1 FROM ordenes o WHERE o.codigo_referido = p_referido_por) THEN
    p_referido_por := NULL;
  END IF;

  IF p_referido_por IS NOT NULL AND EXISTS
     (SELECT 1 FROM ordenes o
      WHERE o.codigo_referido = p_referido_por
        AND lower(o.email) = lower(trim(p_email))) THEN
    p_referido_por := NULL;
  END IF;

  INSERT INTO ordenes AS o (nombre, email, telefono, rut_pasaporte, pack_id, cantidad_stickers,
                        monto_total, referido_por, sorteo_id, vehicle_id)
  VALUES (trim(p_nombre), lower(trim(p_email)), p_telefono, normalizar_rut_pasaporte(p_rut_pasaporte), v_pack.id,
          v_pack.cantidad_stickers, v_pack.precio_total, p_referido_por, v_sorteo.id, v_sorteo.vehicle_id)
  RETURNING o.id, o.codigo_referido INTO v_id, v_codigo;

  v_ref := 'IAC-ORD-' || upper(substr(v_id::text, 1, 8));

  RETURN QUERY SELECT v_id, v_ref, v_pack.precio_total, v_pack.cantidad_stickers, v_codigo;
END;
$$;
REVOKE ALL ON FUNCTION create_pending_order(text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION create_pending_order(text, text, text, text, text, text) TO anon;

-- 2. Comparar con la misma normalización (así compras viejas, con
--    formatos distintos entre sí, igual se reconocen como la misma
--    persona).
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
  v_rut       text := normalizar_rut_pasaporte(p_rut_pasaporte);
  v_codigos   text[];
  v_mi_codigo text;
BEGIN
  SELECT array_agg(DISTINCT o.codigo_referido) INTO v_codigos
  FROM ordenes o
  WHERE lower(o.email) = v_email
    AND normalizar_rut_pasaporte(o.rut_pasaporte) = v_rut
    AND o.estado = 'completado';

  IF v_codigos IS NULL OR array_length(v_codigos, 1) = 0 THEN
    RAISE EXCEPTION 'no_encontrado';
  END IF;

  SELECT o.codigo_referido INTO v_mi_codigo
  FROM ordenes o
  WHERE lower(o.email) = v_email
    AND normalizar_rut_pasaporte(o.rut_pasaporte) = v_rut
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

-- Opcional pero recomendado: deja los RUT ya guardados también en
-- formato consistente, para que el dashboard/CSV del admin se vea
-- prolijo y cualquier futura comparación directa (sin pasar por la
-- función) también funcione. No toca los pasaportes.
UPDATE ordenes SET rut_pasaporte = normalizar_rut_pasaporte(rut_pasaporte)
WHERE normalizar_rut_pasaporte(rut_pasaporte) IS DISTINCT FROM rut_pasaporte;
