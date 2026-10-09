-- ============================================================
-- IAC ARICA 2026 — Parte 56
-- Cierre del Sorteo (Anexo Modificatorio N° 1, firmado 09-oct-2026): no
-- se alcanzó la Meta Mínima de 6.500 Stickers Digitales (cláusula
-- Novena de las bases), así que el Organizador puso término anticipado
-- a la campaña y se devuelve el 100% de lo pagado — el sorteo no se
-- realiza. El Ranking de Referenciadores y sus premios también quedan
-- sin efecto (cláusula Sexta del Anexo).
--
-- Esta parte cierra tres huecos reales encontrados al auditar el cierre:
--   1. Pagos en tránsito: confirmar_orden/confirmar_orden_simulado no
--      revisaban sorteo_config.activo — un pago aprobado DESPUÉS de
--      apagar esa fila seguía generando estampillas reales.
--   2. Confidencialidad: top_referidores, mi_ranking_referidos,
--      stickers_vendidos_count y stickers_comprados_count son RPCs
--      llamables directo con la anon key (pública en js/config.js),
--      sin pasar por el frontend — ocultar botones no alcanza.
--   3. confirmar_orden_simulado (modo ?modo_prueba=) seguía otorgado a
--      "authenticated" (parte 52) — cualquier sesión logueada, no solo
--      admin, podía invocarlo directo.
--
-- IMPORTANTE — después de correr esto, falta además:
--   UPDATE sorteo_config SET activo = false WHERE activo = true;
-- (no se incluye en este archivo porque toca datos, no solo esquema —
-- mismo criterio que el resto de las migraciones de este proyecto).
-- Y apagar el checkbox "Activo" de cada pack en stamper-admin.html →
-- pestaña Packs (defensa en profundidad).
-- ============================================================

-- ── 1. Nuevo estado de orden: pendiente_devolucion ──────────────────
DO $$
DECLARE v_conname text;
BEGIN
  SELECT conname INTO v_conname FROM pg_constraint
  WHERE conrelid = 'ordenes'::regclass AND pg_get_constraintdef(oid) ILIKE '%estado%pendiente_pago%';
  IF v_conname IS NOT NULL THEN EXECUTE format('ALTER TABLE ordenes DROP CONSTRAINT %I', v_conname); END IF;
END $$;

ALTER TABLE ordenes ADD CONSTRAINT ordenes_estado_check
  CHECK (estado IN ('pendiente_pago', 'completado', 'rechazado', 'reembolsado', 'pendiente_devolucion'));

-- ── 2. confirmar_orden: no generar estampillas si el sorteo ya cerró ─
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
  v_sorteo_activo boolean;
BEGIN
  SELECT * INTO v_orden FROM ordenes o WHERE o.id = p_orden_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'orden_no_encontrada'; END IF;
  IF v_orden.estado <> 'pendiente_pago' THEN RAISE EXCEPTION 'orden_ya_procesada'; END IF;

  -- Cierre del sorteo (Anexo Modificatorio N° 1): un pago que se apruebe
  -- DESPUÉS de apagar sorteo_config.activo no debe generar estampillas ni
  -- bono de referidos — la orden queda pendiente de devolución manual en
  -- Mercado Pago, visible en el panel de devoluciones (parte 57).
  SELECT activo INTO v_sorteo_activo FROM sorteo_config WHERE id = v_orden.sorteo_id;
  IF v_sorteo_activo IS FALSE THEN
    UPDATE ordenes SET estado = 'pendiente_devolucion' WHERE id = p_orden_id;
    PERFORM log_system_event('payment', 'critical', 'confirmar_orden',
      'Pago aprobado DESPUÉS del cierre de ventas — orden marcada pendiente_devolucion, requiere reembolso manual en Mercado Pago.',
      jsonb_build_object('monto', v_orden.monto_total, 'email', v_orden.email), p_orden_id);
    RETURN;
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
      v_codigos_persona text[];
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

        SELECT array_agg(o2.codigo_referido) INTO v_codigos_persona
        FROM ordenes o2
        WHERE lower(o2.email) = lower(v_ref_orden.email) AND o2.estado = 'completado';

        SELECT COALESCE(SUM(o.cantidad_stickers), 0) INTO v_total_referidos
        FROM ordenes o
        WHERE o.referido_por = ANY(v_codigos_persona) AND o.estado = 'completado';

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
REVOKE ALL ON FUNCTION confirmar_orden(uuid) FROM public;
GRANT EXECUTE ON FUNCTION confirmar_orden(uuid) TO service_role;

-- ── 3. confirmar_orden_simulado: mismo candado de cierre ─────────────
-- (cuerpo idéntico a la parte 42, con el mismo bloque nuevo al inicio)
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
  v_sorteo_activo boolean;
BEGIN
  SELECT * INTO v_orden FROM ordenes o WHERE o.id = p_orden_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'orden_no_encontrada'; END IF;
  IF v_orden.estado <> 'pendiente_pago' THEN RAISE EXCEPTION 'orden_ya_procesada'; END IF;

  SELECT activo INTO v_sorteo_activo FROM sorteo_config WHERE id = v_orden.sorteo_id;
  IF v_sorteo_activo IS FALSE THEN
    UPDATE ordenes SET estado = 'pendiente_devolucion' WHERE id = p_orden_id;
    PERFORM log_system_event('payment', 'critical', 'confirmar_orden_simulado',
      'Pago simulado aprobado DESPUÉS del cierre de ventas — orden marcada pendiente_devolucion.',
      jsonb_build_object('monto', v_orden.monto_total, 'email', v_orden.email), p_orden_id);
    RETURN;
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
  SET estado = 'completado', confirmado_at = now(), confirmado_por = 'mercadopago-simulado', modo_pago = 'mercadopago'
  WHERE id = p_orden_id;

  IF v_orden.referido_por IS NOT NULL THEN
    DECLARE
      v_ref_orden       ordenes%ROWTYPE;
      v_codigos_persona text[];
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

        SELECT array_agg(o2.codigo_referido) INTO v_codigos_persona
        FROM ordenes o2
        WHERE lower(o2.email) = lower(v_ref_orden.email) AND o2.estado = 'completado';

        SELECT COALESCE(SUM(o.cantidad_stickers), 0) INTO v_total_referidos
        FROM ordenes o
        WHERE o.referido_por = ANY(v_codigos_persona) AND o.estado = 'completado';

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
-- A propósito NO se re-otorga a "authenticated" (lo tenía desde la parte 52):
-- con el sorteo cerrado, nadie más que el service role debe poder confirmar
-- una orden simulada — cierra el hueco de que cualquier sesión logueada
-- (no solo admin) podía invocar esta RPC directo.

-- ── 4. Confidencialidad: revoca acceso público a RPCs con cifras ────
-- La cláusula Sexta del Anexo deja sin efecto el Ranking de
-- Referenciadores — top_referidores y mi_ranking_referidos ya no tienen
-- ningún uso legítimo público. stickers_vendidos_count y
-- stickers_comprados_count exponen cifras de venta directamente a
-- cualquiera con la anon key (pública en js/config.js), sin pasar por
-- el frontend — ocultar botones no alcanza. ranking_referenciadores_admin
-- (parte 45) NO se toca: ya era admin-only, nunca estuvo expuesta.
REVOKE EXECUTE ON FUNCTION top_referidores(integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION mi_ranking_referidos(text, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION stickers_vendidos_count(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION stickers_comprados_count(uuid) FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
