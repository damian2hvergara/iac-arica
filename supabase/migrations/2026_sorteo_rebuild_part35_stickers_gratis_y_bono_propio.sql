-- ============================================================
-- IAC ARICA 2026 — Parte 35
-- Actualización de reglas de negocio (bases legales, revisión final):
--
--   1. Se saca el tope de 10.000 estampillas (partes 30/34) — la venta
--      se cierra solo por fecha, nunca por cantidad.
--   2. Nueva vía gratuita: el admin puede otorgar manualmente un
--      Sticker Digital a ganadores de dinámicas de Instagram, sin
--      compra. No cuenta para la Meta Mínima.
--   3. Cada titular (comprado, gratis por redes, o bono por referido)
--      recibe su propio código de referido compartible — antes los
--      bonos solo agregaban una estampilla extra a la orden del
--      referente, sin código propio.
--
-- Decisión de arquitectura: "ordenes" pasa a ser una tabla general de
-- "eventos que otorgan estampillas", no solo compras — se le agrega
-- una columna tipo (comprado/gratis_redes_sociales/bonus_referido).
-- Cada bono o regalo es una orden nueva con monto_total=0,
-- estado='completado' de entrada, y su propio codigo_referido (la
-- columna ya tiene DEFAULT, no hace falta generarlo a mano). Esto
-- reutiliza toda la infraestructura ya construida (RLS con
-- is_admin(), la relación con estampillas, mi_ranking_referidos que
-- ya agrupa por persona) con el mínimo de código nuevo.
--
-- IMPORTANTE — correr ANTES de esta migración:
--   DELETE FROM estampillas; DELETE FROM ordenes;
-- Los bonos de prueba existentes quedaron guardados al estilo viejo
-- (fila extra en la orden original) y la nueva lógica de conteo de
-- bonos no los va a "ver" — si no se borran, un referente de prueba
-- que vuelva a cruzar un múltiplo de 4 podría llevarse un bono
-- duplicado. La venta real todavía no arranca, así que no hay dato
-- real que perder.
-- ============================================================

-- ── 1. Esquema ────────────────────────────────────────────────
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'comprado'
  CHECK (tipo IN ('comprado','gratis_redes_sociales','bonus_referido'));
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS instagram_handle text;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS dinamica_origen text;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS fecha_dinamica date;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS otorgado_por text;
ALTER TABLE ordenes ALTER COLUMN pack_id DROP NOT NULL;

DO $$
DECLARE v_conname text;
BEGIN
  SELECT conname INTO v_conname FROM pg_constraint
  WHERE conrelid = 'ordenes'::regclass AND pg_get_constraintdef(oid) ILIKE '%modo_pago%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE ordenes DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;
ALTER TABLE ordenes ADD CONSTRAINT ordenes_modo_pago_check CHECK (modo_pago IN ('transferencia','flow','gratis'));

-- ── 2. create_pending_order: sin tope legal ─────────────────────
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

  INSERT INTO ordenes AS o (nombre, email, telefono, rut_pasaporte, pack_id, cantidad_stickers,
                        monto_total, referido_por, sorteo_id, vehicle_id)
  VALUES (trim(p_nombre), lower(trim(p_email)), p_telefono, normalizar_rut_pasaporte(p_rut_pasaporte), v_pack.id,
          v_pack.cantidad_stickers, v_pack.precio_total, p_referido_por, v_sorteo.id, v_sorteo.vehicle_id)
  RETURNING o.id, o.codigo_referido INTO v_id, v_codigo;

  v_ref := 'IAC-ORD-' || upper(substr(v_id::text, 1, 8));

  RETURN QUERY SELECT v_id, v_ref, v_pack.precio_total, v_pack.cantidad_stickers, v_codigo, v_abuso;
END;
$$;
REVOKE ALL ON FUNCTION create_pending_order(text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION create_pending_order(text, text, text, text, text, text) TO anon;

-- ── 3. confirmar_orden / confirmar_orden_simulado: sin tope,
--       bono con orden y código propios ─────────────────────────
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
        -- Bloquea TODAS las órdenes completadas de esa persona (no solo
        -- v_ref_orden) — ahora un bono vive en una orden nueva, así que
        -- dos confirmaciones casi simultáneas de amigos referidos por el
        -- mismo código podrían leer el mismo v_bonos_actuales y duplicar
        -- el bono si solo se bloqueara v_ref_orden.
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
          -- Cada bono es una ORDEN NUEVA a nombre del mismo titular, con
          -- su propio codigo_referido (columna con DEFAULT) — desde ahora
          -- un bono también es un sticker compartible por sí mismo.
          INSERT INTO ordenes (nombre, email, telefono, rut_pasaporte, pack_id,
                                cantidad_stickers, monto_total, modo_pago, estado,
                                tipo, sorteo_id, vehicle_id, confirmado_at, confirmado_por)
          VALUES (v_ref_orden.nombre, v_ref_orden.email, v_ref_orden.telefono, v_ref_orden.rut_pasaporte,
                  NULL, 1, 0, 'gratis', 'completado',
                  'bonus_referido', v_ref_orden.sorteo_id, v_ref_orden.vehicle_id, now(), 'sistema-bono-referido')
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
                                tipo, sorteo_id, vehicle_id, confirmado_at, confirmado_por)
          VALUES (v_ref_orden.nombre, v_ref_orden.email, v_ref_orden.telefono, v_ref_orden.rut_pasaporte,
                  NULL, 1, 0, 'gratis', 'completado',
                  'bonus_referido', v_ref_orden.sorteo_id, v_ref_orden.vehicle_id, now(), 'sistema-bono-referido')
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

-- ── 4. bonos_pendientes_notificacion: busca por persona, no por
--       la orden original (el bono ya no vive ahí) ───────────────
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
  FROM ordenes bo
  WHERE e.orden_id = bo.id
    AND bo.tipo = 'bonus_referido' AND bo.estado = 'completado'
    AND lower(bo.email) = lower(v_ref_orden.email)
    AND e.es_bonus = true AND e.notificado = false
  RETURNING e.numero_folio, e.hash_seguridad, v_ref_orden.email, v_ref_orden.nombre, v_ref_orden.codigo_referido;
END;
$$;
REVOKE ALL ON FUNCTION bonos_pendientes_notificacion(uuid) FROM public;
GRANT EXECUTE ON FUNCTION bonos_pendientes_notificacion(uuid) TO service_role;

-- ── 5. top_referidores: por persona, no por orden ───────────────
CREATE OR REPLACE FUNCTION top_referidores(p_limit integer DEFAULT 5)
RETURNS TABLE(nombre_publico text, total_referido integer)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  WITH referido_totales AS (
    SELECT lower(ref.email) AS email, o.cantidad_stickers
    FROM ordenes o
    JOIN ordenes ref ON ref.codigo_referido = o.referido_por
    WHERE o.estado = 'completado' AND o.referido_por IS NOT NULL
  ),
  por_persona AS (
    SELECT email, SUM(cantidad_stickers)::integer AS total
    FROM referido_totales GROUP BY email HAVING SUM(cantidad_stickers) > 0
  ),
  nombres AS (
    SELECT lower(o.email) AS email, (array_agg(o.nombre ORDER BY o.created_at DESC))[1] AS nombre
    FROM ordenes o WHERE o.estado = 'completado' GROUP BY lower(o.email)
  )
  SELECT
    trim(split_part(n.nombre, ' ', 1)) || ' ' ||
      COALESCE(NULLIF(left(split_part(n.nombre, ' ', 2), 1), ''), '') ||
      CASE WHEN NULLIF(split_part(n.nombre, ' ', 2), '') IS NOT NULL THEN '.' ELSE '' END
      AS nombre_publico,
    pp.total AS total_referido
  FROM por_persona pp JOIN nombres n ON n.email = pp.email
  ORDER BY pp.total DESC
  LIMIT p_limit;
$$;
REVOKE ALL ON FUNCTION top_referidores(integer) FROM public;
GRANT EXECUTE ON FUNCTION top_referidores(integer) TO anon, authenticated;

-- ── 6. Meta Mínima: solo cuenta comprado ─────────────────────────
CREATE OR REPLACE FUNCTION stickers_comprados_count(p_sorteo_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM estampillas e JOIN ordenes o ON o.id = e.orden_id
  WHERE o.estado = 'completado' AND o.tipo = 'comprado'
    AND (p_sorteo_id IS NULL OR o.sorteo_id = p_sorteo_id);
$$;
REVOKE ALL ON FUNCTION stickers_comprados_count(uuid) FROM public;
GRANT EXECUTE ON FUNCTION stickers_comprados_count(uuid) TO anon, authenticated;

-- ── 7. Otorgar sticker gratis (admin-only) ───────────────────────
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

  INSERT INTO ordenes AS o (nombre, email, telefono, rut_pasaporte, pack_id, cantidad_stickers,
                             monto_total, modo_pago, estado, tipo, instagram_handle, dinamica_origen,
                             fecha_dinamica, otorgado_por, sorteo_id, vehicle_id, confirmado_at, confirmado_por)
  VALUES (trim(p_nombre), lower(trim(p_email)), p_telefono, normalizar_rut_pasaporte(p_rut_pasaporte),
          NULL, 1, 0, 'gratis', 'completado', 'gratis_redes_sociales',
          NULLIF(trim(p_instagram_handle), ''), trim(p_dinamica_origen), COALESCE(p_fecha_dinamica, CURRENT_DATE),
          auth.email(), v_sorteo.id, v_sorteo.vehicle_id, now(), auth.email())
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

NOTIFY pgrst, 'reload schema';

-- ── Verificación (correr después) ──
-- Debe devolver 'comprado','gratis_redes_sociales','bonus_referido' (los que existan):
--   SELECT DISTINCT tipo FROM ordenes;
-- Debe funcionar sin importar cuántas estén vendidas (ya no hay tope):
--   SELECT create_pending_order('Test','test@test.com','+56911111111','11.111.111-1','individual', NULL);
