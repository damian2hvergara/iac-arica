-- ============================================================
-- IAC ARICA 2026 — Parte 32
-- create_pending_order es la única función que recibe texto libre de
-- un visitante anónimo sin ningún login de por medio (nombre,
-- teléfono, RUT/pasaporte, código de referido). SQLi no es posible
-- estructuralmente (todo son parámetros, nunca SQL armado a mano) y
-- el HTML ya se escapa al mostrarlo (admin y correos), así que esto
-- es sobre detectar la INTENCIÓN de un ataque, no cerrar un hueco real.
--
-- Si el texto sospechoso viene junto con un dato que además falla su
-- propia validación (nombre muy corto, etc.), la función igual
-- termina en RAISE EXCEPTION y ese INSERT en system_events se revierte
-- con el resto de la transacción (todo-o-nada en Postgres) — caso
-- raro, aceptado; se deja un RAISE WARNING como respaldo forense
-- (visible en los logs de Postgres, sin correo) para ese caso.
-- ============================================================

CREATE OR REPLACE FUNCTION create_pending_order(
  p_nombre text, p_email text, p_telefono text, p_rut_pasaporte text,
  p_pack_slug text, p_referido_por text DEFAULT NULL
) RETURNS TABLE(orden_id uuid, referencia text, monto_total integer, cantidad_stickers integer, codigo_referido text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pack     packs_config;
  v_sorteo   sorteo_config;
  v_id       uuid;
  v_ref      text;
  v_codigo   text;
  v_vendidas integer;
  v_patron_sospechoso constant text :=
    '<script|javascript:|onerror\s*=|onload\s*=|<iframe|drop\s+table|union\s+select|insert\s+into|delete\s+from|;\s*--|xp_cmdshell|\bor\b\s+1\s*=\s*1';
BEGIN
  IF p_nombre IS NULL OR length(trim(p_nombre)) < 3 THEN RAISE EXCEPTION 'nombre_invalido'; END IF;
  IF p_email IS NULL OR p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'email_invalido'; END IF;
  IF p_telefono IS NULL OR length(trim(p_telefono)) < 8 THEN RAISE EXCEPTION 'telefono_invalido'; END IF;
  IF p_rut_pasaporte IS NULL OR length(trim(p_rut_pasaporte)) < 5 THEN RAISE EXCEPTION 'rut_invalido'; END IF;

  -- Detección de intento de inyección (no bloquea la compra — ver nota arriba).
  IF p_nombre ~* v_patron_sospechoso OR p_telefono ~* v_patron_sospechoso
     OR p_rut_pasaporte ~* v_patron_sospechoso
     OR (p_referido_por IS NOT NULL AND p_referido_por ~* v_patron_sospechoso) THEN
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

  IF v_sorteo.total_stickers_emitidos IS NOT NULL THEN
    v_vendidas := stickers_vendidos_count(v_sorteo.id);
    IF v_vendidas + v_pack.cantidad_stickers > v_sorteo.total_stickers_emitidos THEN
      BEGIN
        PERFORM log_system_event('payment', 'high', 'create_pending_order',
          'Tope legal de estampillas alcanzado — se está rechazando la venta.',
          jsonb_build_object('vendidas', v_vendidas, 'tope', v_sorteo.total_stickers_emitidos, 'pack', p_pack_slug));
      EXCEPTION WHEN undefined_function THEN
        NULL;
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

NOTIFY pgrst, 'reload schema';
