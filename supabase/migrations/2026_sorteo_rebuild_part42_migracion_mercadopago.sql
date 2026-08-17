-- ============================================================
-- IAC ARICA 2026 — Parte 42
-- Migración de pagos: Flow (caído) → Mercado Pago (Payment Brick).
-- Se eliminan las columnas específicas de Flow y se agregan las de
-- Mercado Pago. modo_pago cambia su valor 'flow' por 'mercadopago'
-- (se usa tanto para pagos reales como para la ventana de pruebas
-- vía confirmar_orden_simulado, igual que 'flow' se usaba antes).
-- ============================================================

ALTER TABLE ordenes DROP COLUMN IF EXISTS flow_token;
ALTER TABLE ordenes DROP COLUMN IF EXISTS flow_order;

ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS mp_payment_id text;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS mp_preference_id text;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS mp_payment_status text;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS mp_payment_type text;

CREATE INDEX IF NOT EXISTS idx_ordenes_mp_payment_id ON ordenes(mp_payment_id) WHERE mp_payment_id IS NOT NULL;

-- modo_pago: reemplaza 'flow' por 'mercadopago' en el CHECK (se busca
-- el nombre real de la constraint en vez de asumirlo, mismo patrón
-- ya usado en la parte 35). El UPDATE va ANTES de agregar la
-- constraint nueva — Postgres valida un CHECK contra las filas ya
-- existentes al crearlo, así que si todavía quedan filas en 'flow'
-- en ese momento, el ALTER TABLE falla.
DO $$
DECLARE v_conname text;
BEGIN
  SELECT conname INTO v_conname FROM pg_constraint
  WHERE conrelid = 'ordenes'::regclass AND pg_get_constraintdef(oid) ILIKE '%modo_pago%';
  IF v_conname IS NOT NULL THEN EXECUTE format('ALTER TABLE ordenes DROP CONSTRAINT %I', v_conname); END IF;
END $$;

UPDATE ordenes SET modo_pago = 'mercadopago' WHERE modo_pago = 'flow';

ALTER TABLE ordenes ADD CONSTRAINT ordenes_modo_pago_check CHECK (modo_pago IN ('transferencia','mercadopago','gratis'));

-- confirmar_orden_simulado: mismo cuerpo de la parte 41, solo cambia
-- el valor de modo_pago que deja al confirmar una compra simulada.
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

NOTIFY pgrst, 'reload schema';
