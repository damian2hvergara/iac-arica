-- ============================================================
-- IAC ARICA 2026 — Parte 6
-- 1. Las estampillas bonus por referido NO cuentan como "vendidas"
--    (no se recibió dinero por ellas) — se excluyen de
--    stickers_vendidos_count(), que es lo que alimenta el progreso
--    hacia la Meta Mínima.
-- 2. El bono de referido debe entregarse por CADA amigo que compre,
--    no solo una vez en total. La versión anterior de confirmar_orden()
--    /confirmar_orden_simulado() bloqueaba cualquier bono adicional
--    después del primero (columna bono_aplicado). Se corrige para que
--    el límite sea "una vez por amigo referido" (ya garantizado porque
--    cada orden solo se puede confirmar una vez), no "una vez en total
--    por referente".
-- Ejecutar después de las partes 1 a 5, en Supabase → SQL Editor.
-- ============================================================

CREATE OR REPLACE FUNCTION stickers_vendidos_count(p_sorteo_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM estampillas e
  JOIN ordenes o ON o.id = e.orden_id
  WHERE o.estado = 'completado'
    AND e.es_bonus = false
    AND (p_sorteo_id IS NULL OR o.sorteo_id = p_sorteo_id);
$$;

CREATE OR REPLACE FUNCTION confirmar_orden(p_orden_id uuid)
RETURNS TABLE(numero_folio text, hash_seguridad text, orden_en_pack integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orden    ordenes%ROWTYPE;
  v_i        integer;
  v_folio    text;
  v_hash     text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  SELECT * INTO v_orden FROM ordenes WHERE id = p_orden_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'orden_no_encontrada'; END IF;
  IF v_orden.estado <> 'pendiente_pago' THEN RAISE EXCEPTION 'orden_ya_procesada'; END IF;

  FOR v_i IN 1..v_orden.cantidad_stickers LOOP
    LOOP
      v_folio := array_to_string(ARRAY(
        SELECT substr(v_alphabet, (floor(random() * 32) + 1)::int, 1)
        FROM generate_series(1, 8)), '');
      v_folio := 'IAC-' || substr(v_folio, 1, 4) || '-' || substr(v_folio, 5, 4);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM estampillas WHERE numero_folio = v_folio);
    END LOOP;

    v_hash := upper(substr(encode(
      digest(v_folio || '|' || v_orden.email || '|' || now()::text || '|IAC-ARICA-2026', 'sha256'), 'hex'
    ), 1, 16));

    INSERT INTO estampillas (orden_id, numero_folio, hash_seguridad, orden_en_pack)
    VALUES (p_orden_id, v_folio, v_hash, v_i);

    RETURN QUERY SELECT v_folio, v_hash, v_i;
  END LOOP;

  UPDATE ordenes SET estado='completado', confirmado_at=now(), confirmado_por=auth.email()
  WHERE id = p_orden_id;

  -- Bono de referido: 1 estampilla gratis al referente, por CADA amigo
  -- que compre (no solo una vez). Protegido de duplicados porque esta
  -- función completa solo puede correr una vez por orden (el chequeo
  -- de estado de arriba lo garantiza) — y solo se otorga si el
  -- referente ya tiene su propia compra pagada.
  IF v_orden.referido_por IS NOT NULL THEN
    DECLARE
      v_ref_orden ordenes%ROWTYPE;
      v_pos       integer;
    BEGIN
      SELECT * INTO v_ref_orden FROM ordenes
      WHERE codigo_referido = v_orden.referido_por AND estado = 'completado'
      FOR UPDATE;

      IF FOUND THEN
        SELECT COALESCE(MAX(orden_en_pack), 0) + 1 INTO v_pos
        FROM estampillas WHERE orden_id = v_ref_orden.id;

        v_folio := 'IAC-BONUS-' || upper(substr(md5(random()::text), 1, 4));
        v_hash  := upper(substr(encode(digest(v_folio || '|bonus|' || now()::text, 'sha256'), 'hex'), 1, 16));

        INSERT INTO estampillas (orden_id, numero_folio, hash_seguridad, orden_en_pack, es_bonus)
        VALUES (v_ref_orden.id, v_folio, v_hash, v_pos, true);
      END IF;
    END;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION confirmar_orden(uuid) FROM public;
GRANT EXECUTE ON FUNCTION confirmar_orden(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION confirmar_orden_simulado(p_orden_id uuid)
RETURNS TABLE(numero_folio text, hash_seguridad text, orden_en_pack integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orden    ordenes%ROWTYPE;
  v_i        integer;
  v_folio    text;
  v_hash     text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  SELECT * INTO v_orden FROM ordenes WHERE id = p_orden_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'orden_no_encontrada'; END IF;
  IF v_orden.estado <> 'pendiente_pago' THEN RAISE EXCEPTION 'orden_ya_procesada'; END IF;

  FOR v_i IN 1..v_orden.cantidad_stickers LOOP
    LOOP
      v_folio := array_to_string(ARRAY(
        SELECT substr(v_alphabet, (floor(random() * 32) + 1)::int, 1)
        FROM generate_series(1, 8)), '');
      v_folio := 'IAC-' || substr(v_folio, 1, 4) || '-' || substr(v_folio, 5, 4);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM estampillas WHERE numero_folio = v_folio);
    END LOOP;

    v_hash := upper(substr(encode(
      digest(v_folio || '|' || v_orden.email || '|' || now()::text || '|IAC-ARICA-2026', 'sha256'), 'hex'
    ), 1, 16));

    INSERT INTO estampillas (orden_id, numero_folio, hash_seguridad, orden_en_pack)
    VALUES (p_orden_id, v_folio, v_hash, v_i);

    RETURN QUERY SELECT v_folio, v_hash, v_i;
  END LOOP;

  UPDATE ordenes
  SET estado = 'completado', confirmado_at = now(), confirmado_por = 'flow-simulado', modo_pago = 'flow'
  WHERE id = p_orden_id;

  IF v_orden.referido_por IS NOT NULL THEN
    DECLARE
      v_ref_orden ordenes%ROWTYPE;
      v_pos       integer;
    BEGIN
      SELECT * INTO v_ref_orden FROM ordenes
      WHERE codigo_referido = v_orden.referido_por AND estado = 'completado'
      FOR UPDATE;

      IF FOUND THEN
        SELECT COALESCE(MAX(orden_en_pack), 0) + 1 INTO v_pos
        FROM estampillas WHERE orden_id = v_ref_orden.id;

        v_folio := 'IAC-BONUS-' || upper(substr(md5(random()::text), 1, 4));
        v_hash  := upper(substr(encode(digest(v_folio || '|bonus|' || now()::text, 'sha256'), 'hex'), 1, 16));

        INSERT INTO estampillas (orden_id, numero_folio, hash_seguridad, orden_en_pack, es_bonus)
        VALUES (v_ref_orden.id, v_folio, v_hash, v_pos, true);
      END IF;
    END;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION confirmar_orden_simulado(uuid) FROM public;
GRANT EXECUTE ON FUNCTION confirmar_orden_simulado(uuid) TO anon;
