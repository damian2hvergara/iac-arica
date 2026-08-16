-- ============================================================
-- IAC ARICA 2026 — Parte 30
-- Las bases legales fijan un tope de 10.000 estampillas emitidas
-- (sorteo_config.total_stickers_emitidos), pero nada en el código lo
-- hacía cumplir — create_pending_order/confirmar_orden nunca lo
-- comparaban contra las ventas reales. Se agrega en dos puntos:
--
--   1. create_pending_order: rechazo rápido ANTES de cobrar nada
--      (no evita del todo una carrera entre dos confirmaciones casi
--      simultáneas, por eso el candado real es el punto 2).
--   2. confirmar_orden / confirmar_orden_simulado: candado real, con
--      lock de fila sobre sorteo_config, justo antes de generar
--      folios — si dos webhooks de Flow llegan casi al mismo tiempo,
--      el segundo espera al primero y ve el conteo ya actualizado.
--      Si este segundo candado se dispara, es porque Flow YA cobró
--      esa compra — requiere reembolso manual, por eso se loggea
--      como evento payment/critical (requiere que la parte 31,
--      log_system_event(), ya esté corrida — ver instrucciones).
--
-- IMPORTANTE: correr la parte 31 (system_events / log_system_event)
-- ANTES que esta, porque el candado de confirmar_orden llama a
-- log_system_event() para avisar si se dispara.
-- ============================================================

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
  v_vendidas integer;
BEGIN
  IF p_nombre IS NULL OR length(trim(p_nombre)) < 3 THEN RAISE EXCEPTION 'nombre_invalido'; END IF;
  IF p_email IS NULL OR p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'email_invalido'; END IF;
  IF p_telefono IS NULL OR length(trim(p_telefono)) < 8 THEN RAISE EXCEPTION 'telefono_invalido'; END IF;
  IF p_rut_pasaporte IS NULL OR length(trim(p_rut_pasaporte)) < 5 THEN RAISE EXCEPTION 'rut_invalido'; END IF;

  SELECT * INTO v_pack FROM packs_config WHERE slug = p_pack_slug AND activo = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'pack_invalido'; END IF;

  SELECT * INTO v_sorteo FROM sorteo_config WHERE activo = true LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'sorteo_no_activo'; END IF;

  IF v_sorteo.total_stickers_emitidos IS NOT NULL THEN
    v_vendidas := stickers_vendidos_count(v_sorteo.id);
    IF v_vendidas + v_pack.cantidad_stickers > v_sorteo.total_stickers_emitidos THEN
      BEGIN
        PERFORM log_system_event('payment', 'high', 'create_pending_order',
          'Tope legal de estampillas alcanzado — se está rechazando la venta.',
          jsonb_build_object('vendidas', v_vendidas, 'tope', v_sorteo.total_stickers_emitidos, 'pack', p_pack_slug));
      EXCEPTION WHEN undefined_function THEN
        NULL; -- log_system_event todavía no existe (parte 31 no corrida) — no bloquea la venta por eso
      END;
      RAISE EXCEPTION 'tope_legal_alcanzado';
    END IF;
  END IF;

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
  v_tope     integer;
  v_vendidas integer;
BEGIN
  SELECT * INTO v_orden FROM ordenes o WHERE o.id = p_orden_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'orden_no_encontrada'; END IF;
  IF v_orden.estado <> 'pendiente_pago' THEN RAISE EXCEPTION 'orden_ya_procesada'; END IF;

  -- Candado real del tope legal: lock de fila sobre sorteo_config para
  -- serializar confirmaciones simultáneas (dos webhooks de Flow a la vez).
  PERFORM 1 FROM sorteo_config WHERE id = v_orden.sorteo_id FOR UPDATE;
  SELECT total_stickers_emitidos INTO v_tope FROM sorteo_config WHERE id = v_orden.sorteo_id;
  IF v_tope IS NOT NULL THEN
    v_vendidas := stickers_vendidos_count(v_orden.sorteo_id);
    IF v_vendidas + v_orden.cantidad_stickers > v_tope THEN
      BEGIN
        PERFORM log_system_event('payment', 'critical', 'confirmar_orden',
          'Tope legal superado DESPUÉS de un cobro real de Flow — requiere reembolso manual.',
          jsonb_build_object('orden_id', p_orden_id, 'vendidas', v_vendidas, 'tope', v_tope), p_orden_id);
      EXCEPTION WHEN undefined_function THEN
        NULL;
      END;
      RAISE EXCEPTION 'tope_legal_superado';
    END IF;
  END IF;

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
GRANT EXECUTE ON FUNCTION confirmar_orden(uuid) TO service_role;

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
  v_tope     integer;
  v_vendidas integer;
BEGIN
  SELECT * INTO v_orden FROM ordenes o WHERE o.id = p_orden_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'orden_no_encontrada'; END IF;
  IF v_orden.estado <> 'pendiente_pago' THEN RAISE EXCEPTION 'orden_ya_procesada'; END IF;

  PERFORM 1 FROM sorteo_config WHERE id = v_orden.sorteo_id FOR UPDATE;
  SELECT total_stickers_emitidos INTO v_tope FROM sorteo_config WHERE id = v_orden.sorteo_id;
  IF v_tope IS NOT NULL THEN
    v_vendidas := stickers_vendidos_count(v_orden.sorteo_id);
    IF v_vendidas + v_orden.cantidad_stickers > v_tope THEN
      RAISE EXCEPTION 'tope_legal_superado';
    END IF;
  END IF;

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
GRANT EXECUTE ON FUNCTION confirmar_orden_simulado(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
