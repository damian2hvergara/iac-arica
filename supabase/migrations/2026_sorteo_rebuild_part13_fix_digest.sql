-- ============================================================
-- IAC ARICA 2026 — Parte 13
-- Fix: "function digest(text, unknown) does not exist".
--
-- Causa: Supabase instala la extensión pgcrypto en el esquema
-- "extensions", no en "public". Las funciones confirmar_orden y
-- confirmar_orden_simulado tenían SET search_path = public (a
-- propósito, por seguridad, para que no se pueda hacer schema
-- hijacking), pero eso las deja sin poder ver digest(). Se agrega
-- "extensions" al search_path de ambas.
-- ============================================================

CREATE OR REPLACE FUNCTION confirmar_orden(p_orden_id uuid)
RETURNS TABLE(numero_folio text, hash_seguridad text, orden_en_pack integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_orden    ordenes%ROWTYPE;
  v_i        integer;
  v_folio    text;
  v_hash     text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  SELECT * INTO v_orden FROM ordenes o WHERE o.id = p_orden_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'orden_no_encontrada'; END IF;
  IF v_orden.estado <> 'pendiente_pago' THEN RAISE EXCEPTION 'orden_ya_procesada'; END IF;

  FOR v_i IN 1..v_orden.cantidad_stickers LOOP
    LOOP
      v_folio := array_to_string(ARRAY(
        SELECT substr(v_alphabet, (floor(random() * 32) + 1)::int, 1)
        FROM generate_series(1, 8)), '');
      v_folio := 'IAC-' || substr(v_folio, 1, 4) || '-' || substr(v_folio, 5, 4);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM estampillas e WHERE e.numero_folio = v_folio);
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

  IF v_orden.referido_por IS NOT NULL THEN
    DECLARE
      v_ref_orden       ordenes%ROWTYPE;
      v_pos             integer;
      v_total_referidos integer;
      v_bonos_esperados integer;
      v_bonos_actuales  integer;
      v_j               integer;
    BEGIN
      SELECT * INTO v_ref_orden FROM ordenes o
      WHERE o.codigo_referido = v_orden.referido_por AND o.estado = 'completado'
      FOR UPDATE;

      IF FOUND THEN
        SELECT COALESCE(SUM(o.cantidad_stickers), 0) INTO v_total_referidos
        FROM ordenes o
        WHERE o.referido_por = v_orden.referido_por AND o.estado = 'completado';

        v_bonos_esperados := v_total_referidos / 4;

        SELECT COUNT(*) INTO v_bonos_actuales
        FROM estampillas e WHERE e.orden_id = v_ref_orden.id AND e.es_bonus = true;

        FOR v_j IN 1..(v_bonos_esperados - v_bonos_actuales) LOOP
          SELECT COALESCE(MAX(e.orden_en_pack), 0) + 1 INTO v_pos
          FROM estampillas e WHERE e.orden_id = v_ref_orden.id;

          v_folio := 'IAC-BONUS-' || upper(substr(md5(random()::text), 1, 4));
          v_hash  := upper(substr(encode(
            digest(v_folio || '|bonus|' || now()::text || '|' || v_j::text, 'sha256'), 'hex'
          ), 1, 16));

          INSERT INTO estampillas (orden_id, numero_folio, hash_seguridad, orden_en_pack, es_bonus)
          VALUES (v_ref_orden.id, v_folio, v_hash, v_pos, true);
        END LOOP;
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
SET search_path = public, extensions
AS $$
DECLARE
  v_orden    ordenes%ROWTYPE;
  v_i        integer;
  v_folio    text;
  v_hash     text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  SELECT * INTO v_orden FROM ordenes o WHERE o.id = p_orden_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'orden_no_encontrada'; END IF;
  IF v_orden.estado <> 'pendiente_pago' THEN RAISE EXCEPTION 'orden_ya_procesada'; END IF;

  FOR v_i IN 1..v_orden.cantidad_stickers LOOP
    LOOP
      v_folio := array_to_string(ARRAY(
        SELECT substr(v_alphabet, (floor(random() * 32) + 1)::int, 1)
        FROM generate_series(1, 8)), '');
      v_folio := 'IAC-' || substr(v_folio, 1, 4) || '-' || substr(v_folio, 5, 4);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM estampillas e WHERE e.numero_folio = v_folio);
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
      v_ref_orden       ordenes%ROWTYPE;
      v_pos             integer;
      v_total_referidos integer;
      v_bonos_esperados integer;
      v_bonos_actuales  integer;
      v_j               integer;
    BEGIN
      SELECT * INTO v_ref_orden FROM ordenes o
      WHERE o.codigo_referido = v_orden.referido_por AND o.estado = 'completado'
      FOR UPDATE;

      IF FOUND THEN
        SELECT COALESCE(SUM(o.cantidad_stickers), 0) INTO v_total_referidos
        FROM ordenes o
        WHERE o.referido_por = v_orden.referido_por AND o.estado = 'completado';

        v_bonos_esperados := v_total_referidos / 4;

        SELECT COUNT(*) INTO v_bonos_actuales
        FROM estampillas e WHERE e.orden_id = v_ref_orden.id AND e.es_bonus = true;

        FOR v_j IN 1..(v_bonos_esperados - v_bonos_actuales) LOOP
          SELECT COALESCE(MAX(e.orden_en_pack), 0) + 1 INTO v_pos
          FROM estampillas e WHERE e.orden_id = v_ref_orden.id;

          v_folio := 'IAC-BONUS-' || upper(substr(md5(random()::text), 1, 4));
          v_hash  := upper(substr(encode(
            digest(v_folio || '|bonus|' || now()::text || '|' || v_j::text, 'sha256'), 'hex'
          ), 1, 16));

          INSERT INTO estampillas (orden_id, numero_folio, hash_seguridad, orden_en_pack, es_bonus)
          VALUES (v_ref_orden.id, v_folio, v_hash, v_pos, true);
        END LOOP;
      END IF;
    END;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION confirmar_orden_simulado(uuid) FROM public;
GRANT EXECUTE ON FUNCTION confirmar_orden_simulado(uuid) TO anon;
