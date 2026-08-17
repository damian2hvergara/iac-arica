-- ============================================================
-- IAC ARICA 2026 — Parte 39
-- codigo_referido se generaba nuevo (DEFAULT) en CADA orden, sin
-- excepción: comprar dos veces, o comprar y después ganar un sticker
-- gratis por redes, o ganar un bono, le daba a la misma persona
-- varios códigos distintos — uno por correo de confirmación.
--
-- Esto rompía el conteo de bonos: mi_ranking_referidos/top_referidores
-- (parte 25/36) YA suman los referidos de TODOS los códigos de una
-- persona, pero confirmar_orden()/confirmar_orden_simulado() solo
-- contaban los referidos del código específico usado en esa compra
-- puntual. Resultado real: el panel podía mostrar "4 referidos, 1
-- sticker gratis desbloqueado" sin que el sistema hubiera creado esa
-- orden de bono — un premio prometido en pantalla y nunca entregado
-- (cláusula Décimo Séptima).
--
-- Fix de raíz: toda orden nueva de una persona (compra repetida,
-- sticker gratis por redes, bono) reutiliza su codigo_referido
-- ORIGINAL en vez de generar uno nuevo. Con un solo código por
-- persona, siempre, el problema de "sumar entre códigos" deja de
-- poder ocurrir — no hace falta reconciliar nada en las consultas.
-- ============================================================

-- ── 1. create_pending_order: reutiliza el código si la persona ya
--       tiene una orden anterior (cualquier estado) ────────────────
CREATE OR REPLACE FUNCTION create_pending_order(
  p_nombre text, p_email text, p_telefono text, p_rut_pasaporte text,
  p_pack_slug text, p_referido_por text DEFAULT NULL
) RETURNS TABLE(orden_id uuid, referencia text, monto_total integer, cantidad_stickers integer,
                codigo_referido text, abuso_detectado boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pack   packs_config;
  v_sorteo sorteo_config;
  v_id     uuid;
  v_ref    text;
  v_codigo text;
  v_codigo_existente text;
  v_abuso  boolean := false;
  v_patron_sospechoso constant text :=
    '<script|javascript:|onerror\s*=|onload\s*=|<iframe|drop\s+table|union\s+select|insert\s+into|delete\s+from|;\s*--|xp_cmdshell|\bor\b\s+1\s*=\s*1';
BEGIN
  IF p_nombre IS NULL OR length(trim(p_nombre)) < 3 THEN RAISE EXCEPTION 'nombre_invalido'; END IF;
  IF p_email IS NULL OR p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'email_invalido'; END IF;
  IF p_telefono IS NULL OR length(trim(p_telefono)) < 8 THEN RAISE EXCEPTION 'telefono_invalido'; END IF;
  IF p_rut_pasaporte IS NULL OR length(trim(p_rut_pasaporte)) < 5 THEN RAISE EXCEPTION 'rut_invalido'; END IF;

  IF p_nombre ~* v_patron_sospechoso OR p_telefono ~* v_patron_sospechoso
     OR p_rut_pasaporte ~* v_patron_sospechoso
     OR (p_referido_por IS NOT NULL AND p_referido_por ~* v_patron_sospechoso) THEN
    v_abuso := true;
    BEGIN
      PERFORM log_system_event('abuse', 'high', 'create_pending_order',
        'Texto con forma de XSS/SQLi en un campo del checkout.',
        jsonb_build_object('nombre', left(p_nombre, 200), 'telefono', left(p_telefono, 200),
                            'rut_pasaporte', left(p_rut_pasaporte, 200), 'referido_por', p_referido_por));
    EXCEPTION WHEN undefined_function THEN
      RAISE WARNING 'system_events no disponible todavía — intento sospechoso no quedó registrado: nombre=%', left(p_nombre, 200);
    END;
  END IF;

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

  -- Un solo código por persona, para siempre: si ya tiene alguna orden
  -- previa (de cualquier estado), se reutiliza su código más antiguo.
  SELECT o.codigo_referido INTO v_codigo_existente
  FROM ordenes o
  WHERE lower(o.email) = lower(trim(p_email))
  ORDER BY o.created_at ASC
  LIMIT 1;

  INSERT INTO ordenes AS o (nombre, email, telefono, rut_pasaporte, pack_id, cantidad_stickers,
                        monto_total, referido_por, sorteo_id, vehicle_id, codigo_referido)
  VALUES (trim(p_nombre), lower(trim(p_email)), p_telefono, normalizar_rut_pasaporte(p_rut_pasaporte), v_pack.id,
          v_pack.cantidad_stickers, v_pack.precio_total, p_referido_por, v_sorteo.id, v_sorteo.vehicle_id,
          COALESCE(v_codigo_existente, substr(md5(random()::text || clock_timestamp()::text), 1, 8)))
  RETURNING o.id, o.codigo_referido INTO v_id, v_codigo;

  v_ref := 'IAC-ORD-' || upper(substr(v_id::text, 1, 8));

  RETURN QUERY SELECT v_id, v_ref, v_pack.precio_total, v_pack.cantidad_stickers, v_codigo, v_abuso;
END;
$$;
REVOKE ALL ON FUNCTION create_pending_order(text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION create_pending_order(text, text, text, text, text, text) TO anon;

-- ── 2. otorgar_sticker_gratis: mismo criterio ────────────────────
CREATE OR REPLACE FUNCTION otorgar_sticker_gratis(
  p_nombre text, p_email text, p_telefono text, p_rut_pasaporte text,
  p_instagram_handle text, p_dinamica_origen text, p_fecha_dinamica date DEFAULT CURRENT_DATE
) RETURNS TABLE(orden_id uuid, numero_folio text, hash_seguridad text, codigo_referido text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sorteo   sorteo_config;
  v_id       uuid;
  v_codigo   text;
  v_codigo_existente text;
  v_folio    text;
  v_hash     text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'no_autorizado'; END IF;

  IF p_nombre IS NULL OR length(trim(p_nombre)) < 3 THEN RAISE EXCEPTION 'nombre_invalido'; END IF;
  IF p_email IS NULL OR p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'email_invalido'; END IF;
  IF p_telefono IS NULL OR length(trim(p_telefono)) < 8 THEN RAISE EXCEPTION 'telefono_invalido'; END IF;
  IF p_rut_pasaporte IS NULL OR length(trim(p_rut_pasaporte)) < 5 THEN RAISE EXCEPTION 'rut_invalido'; END IF;
  IF p_dinamica_origen IS NULL OR length(trim(p_dinamica_origen)) < 3 THEN RAISE EXCEPTION 'dinamica_invalida'; END IF;

  SELECT * INTO v_sorteo FROM sorteo_config WHERE activo = true LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'sorteo_no_activo'; END IF;

  SELECT o.codigo_referido INTO v_codigo_existente
  FROM ordenes o
  WHERE lower(o.email) = lower(trim(p_email))
  ORDER BY o.created_at ASC
  LIMIT 1;

  INSERT INTO ordenes AS o (nombre, email, telefono, rut_pasaporte, pack_id, cantidad_stickers,
                             monto_total, modo_pago, estado, tipo, instagram_handle, dinamica_origen,
                             fecha_dinamica, otorgado_por, sorteo_id, vehicle_id, confirmado_at, confirmado_por,
                             codigo_referido)
  VALUES (trim(p_nombre), lower(trim(p_email)), p_telefono, normalizar_rut_pasaporte(p_rut_pasaporte),
          NULL, 1, 0, 'gratis', 'completado', 'gratis_redes_sociales',
          NULLIF(trim(p_instagram_handle), ''), trim(p_dinamica_origen), COALESCE(p_fecha_dinamica, CURRENT_DATE),
          auth.email(), v_sorteo.id, v_sorteo.vehicle_id, now(), auth.email(),
          COALESCE(v_codigo_existente, substr(md5(random()::text || clock_timestamp()::text), 1, 8)))
  RETURNING o.id, o.codigo_referido INTO v_id, v_codigo;

  LOOP
    v_folio := array_to_string(ARRAY(
      SELECT substr(v_alphabet, (floor(random() * 32) + 1)::int, 1) FROM generate_series(1, 8)), '');
    v_folio := 'IAC-' || substr(v_folio, 1, 4) || '-' || substr(v_folio, 5, 4);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM estampillas e WHERE e.numero_folio = v_folio);
  END LOOP;

  v_hash := upper(substr(encode(
    digest(v_folio || '|' || lower(trim(p_email)) || '|' || now()::text || '|IAC-ARICA-2026-GRATIS', 'sha256'), 'hex'
  ), 1, 16));

  INSERT INTO estampillas (orden_id, numero_folio, hash_seguridad, orden_en_pack)
  VALUES (v_id, v_folio, v_hash, 1);

  RETURN QUERY SELECT v_id, v_folio, v_hash, v_codigo;
END;
$$;
REVOKE ALL ON FUNCTION otorgar_sticker_gratis(text, text, text, text, text, text, date) FROM public;
GRANT EXECUTE ON FUNCTION otorgar_sticker_gratis(text, text, text, text, text, text, date) TO authenticated;

-- ── 3. confirmar_orden / confirmar_orden_simulado: la orden de bono
--       reutiliza el código de v_ref_orden en vez de generar uno
--       nuevo (ya no hace falta "propio" — con el fix de arriba,
--       v_ref_orden.codigo_referido YA ES el código único de esa
--       persona) ─────────────────────────────────────────────────
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
      v_total_referidos integer;
      v_bonos_esperados integer;
      v_bonos_actuales  integer;
      v_bonus_orden_id  uuid;
      v_j               integer;
    BEGIN
      SELECT * INTO v_ref_orden FROM ordenes o
      WHERE o.codigo_referido = v_orden.referido_por AND o.estado = 'completado'
      FOR UPDATE;

      IF FOUND THEN
        PERFORM 1 FROM ordenes o
        WHERE lower(o.email) = lower(v_ref_orden.email) AND o.estado = 'completado'
        FOR UPDATE;

        SELECT COALESCE(SUM(o.cantidad_stickers), 0) INTO v_total_referidos
        FROM ordenes o
        WHERE o.referido_por = v_orden.referido_por AND o.estado = 'completado';

        v_bonos_esperados := v_total_referidos / 4;

        SELECT COUNT(*) INTO v_bonos_actuales
        FROM estampillas e
        JOIN ordenes bo ON bo.id = e.orden_id
        WHERE bo.tipo = 'bonus_referido' AND lower(bo.email) = lower(v_ref_orden.email)
          AND e.es_bonus = true;

        FOR v_j IN 1..(v_bonos_esperados - v_bonos_actuales) LOOP
          INSERT INTO ordenes (nombre, email, telefono, rut_pasaporte, pack_id,
                                cantidad_stickers, monto_total, modo_pago, estado,
                                tipo, sorteo_id, vehicle_id, confirmado_at, confirmado_por,
                                codigo_referido)
          VALUES (v_ref_orden.nombre, v_ref_orden.email, v_ref_orden.telefono, v_ref_orden.rut_pasaporte,
                  NULL, 1, 0, 'gratis', 'completado',
                  'bonus_referido', v_ref_orden.sorteo_id, v_ref_orden.vehicle_id, now(), 'sistema-bono-referido',
                  v_ref_orden.codigo_referido)
          RETURNING id INTO v_bonus_orden_id;

          v_folio := 'IAC-BONUS-' || upper(substr(md5(random()::text), 1, 4));
          v_hash  := upper(substr(encode(
            digest(v_folio || '|bonus|' || now()::text || '|' || v_j::text, 'sha256'), 'hex'
          ), 1, 16));

          INSERT INTO estampillas (orden_id, numero_folio, hash_seguridad, orden_en_pack, es_bonus)
          VALUES (v_bonus_orden_id, v_folio, v_hash, 1, true);
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
      v_total_referidos integer;
      v_bonos_esperados integer;
      v_bonos_actuales  integer;
      v_bonus_orden_id  uuid;
      v_j               integer;
    BEGIN
      SELECT * INTO v_ref_orden FROM ordenes o
      WHERE o.codigo_referido = v_orden.referido_por AND o.estado = 'completado'
      FOR UPDATE;

      IF FOUND THEN
        PERFORM 1 FROM ordenes o
        WHERE lower(o.email) = lower(v_ref_orden.email) AND o.estado = 'completado'
        FOR UPDATE;

        SELECT COALESCE(SUM(o.cantidad_stickers), 0) INTO v_total_referidos
        FROM ordenes o
        WHERE o.referido_por = v_orden.referido_por AND o.estado = 'completado';

        v_bonos_esperados := v_total_referidos / 4;

        SELECT COUNT(*) INTO v_bonos_actuales
        FROM estampillas e
        JOIN ordenes bo ON bo.id = e.orden_id
        WHERE bo.tipo = 'bonus_referido' AND lower(bo.email) = lower(v_ref_orden.email)
          AND e.es_bonus = true;

        FOR v_j IN 1..(v_bonos_esperados - v_bonos_actuales) LOOP
          INSERT INTO ordenes (nombre, email, telefono, rut_pasaporte, pack_id,
                                cantidad_stickers, monto_total, modo_pago, estado,
                                tipo, sorteo_id, vehicle_id, confirmado_at, confirmado_por,
                                codigo_referido)
          VALUES (v_ref_orden.nombre, v_ref_orden.email, v_ref_orden.telefono, v_ref_orden.rut_pasaporte,
                  NULL, 1, 0, 'gratis', 'completado',
                  'bonus_referido', v_ref_orden.sorteo_id, v_ref_orden.vehicle_id, now(), 'sistema-bono-referido',
                  v_ref_orden.codigo_referido)
          RETURNING id INTO v_bonus_orden_id;

          v_folio := 'IAC-BONUS-' || upper(substr(md5(random()::text), 1, 4));
          v_hash  := upper(substr(encode(
            digest(v_folio || '|bonus|' || now()::text || '|' || v_j::text, 'sha256'), 'hex'
          ), 1, 16));

          INSERT INTO estampillas (orden_id, numero_folio, hash_seguridad, orden_en_pack, es_bonus)
          VALUES (v_bonus_orden_id, v_folio, v_hash, 1, true);
        END LOOP;
      END IF;
    END;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION confirmar_orden_simulado(uuid) FROM public;
GRANT EXECUTE ON FUNCTION confirmar_orden_simulado(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
