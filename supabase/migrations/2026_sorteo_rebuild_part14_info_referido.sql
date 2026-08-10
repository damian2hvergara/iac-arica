-- ============================================================
-- IAC ARICA 2026 — Parte 14
-- Nueva función: info_referido(codigo). Dado el código de un
-- referente, devuelve sus datos de contacto y su progreso hacia la
-- próxima estampilla bonus (1 cada 4 compradas con su código).
-- La usa el navegador del AMIGO justo después de que su compra se
-- confirma, para poder avisarle al referente por correo.
-- ============================================================

CREATE OR REPLACE FUNCTION info_referido(p_codigo_referido text)
RETURNS TABLE(
  referente_email      text,
  referente_nombre     text,
  total_comprado       integer,
  bonos_ganados        integer,
  faltan_para_proximo  integer
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
BEGIN
  SELECT COALESCE(SUM(o.cantidad_stickers), 0) INTO v_total
  FROM ordenes o
  WHERE o.referido_por = p_codigo_referido AND o.estado = 'completado';

  RETURN QUERY
  SELECT o.email, o.nombre, v_total, (v_total / 4), (4 - (v_total % 4))
  FROM ordenes o
  WHERE o.codigo_referido = p_codigo_referido AND o.estado = 'completado'
  LIMIT 1;
END;
$$;
REVOKE ALL ON FUNCTION info_referido(text) FROM public;
GRANT EXECUTE ON FUNCTION info_referido(text) TO anon, authenticated;
