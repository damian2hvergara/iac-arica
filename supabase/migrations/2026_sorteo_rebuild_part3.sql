-- ============================================================
-- IAC ARICA 2026 — Parte 3
-- Único método de pago: Flow.cl (simulado por ahora, hasta conectar
-- la cuenta real). Se elimina la transferencia manual como flujo activo.
-- Ejecutar después de las partes 1 y 2, en Supabase → SQL Editor.
-- ============================================================

-- De ahora en adelante toda orden nueva nace como 'flow' (antes 'transferencia').
ALTER TABLE ordenes ALTER COLUMN modo_pago SET DEFAULT 'flow';

-- ------------------------------------------------------------
-- confirmar_orden_simulado — reemplazo TEMPORAL del webhook real de
-- Flow.cl mientras no está conectado. Hace exactamente lo mismo que
-- confirmar_orden() (genera folios, marca completado, aplica bono de
-- referido) pero puede llamarla el propio comprador (anon) porque no
-- hay sesión de admin en el checkout público, y dado que hoy no existe
-- un webhook real que confirme el pago.
--
-- ⚠️ CUANDO SE CONECTE FLOW DE VERDAD:
--   1. Crear un Edge Function "flow-webhook" que verifique la firma de
--      Flow y llame a confirmar_orden(p_orden_id) (esa sigue existiendo,
--      es la versión solo-admin/servidor, no se toca).
--   2. Correr: DROP FUNCTION IF EXISTS confirmar_orden_simulado(uuid);
--   3. En stamper.html, cambiar FLOW_MODE de 'simulation' a 'live'.
-- ------------------------------------------------------------
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
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sin O,0,I,1
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
      WHERE codigo_referido = v_orden.referido_por AND bono_aplicado = false
      FOR UPDATE;

      IF FOUND THEN
        SELECT COALESCE(MAX(orden_en_pack), 0) + 1 INTO v_pos
        FROM estampillas WHERE orden_id = v_ref_orden.id;

        v_folio := 'IAC-BONUS-' || upper(substr(md5(random()::text), 1, 4));
        v_hash  := upper(substr(encode(digest(v_folio || '|bonus|' || now()::text, 'sha256'), 'hex'), 1, 16));

        INSERT INTO estampillas (orden_id, numero_folio, hash_seguridad, orden_en_pack, es_bonus)
        VALUES (v_ref_orden.id, v_folio, v_hash, v_pos, true);

        UPDATE ordenes SET bono_aplicado = true WHERE id = v_ref_orden.id;
      END IF;
    END;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION confirmar_orden_simulado(uuid) FROM public;
GRANT EXECUTE ON FUNCTION confirmar_orden_simulado(uuid) TO anon;
