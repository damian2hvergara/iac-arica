-- ============================================================
-- IAC ARICA 2026 — Parte 44 (HOTFIX urgente)
-- rechazar_orden() exige is_admin() incondicionalmente desde la parte
-- 27 — bloqueaba tanto a un admin sin sesión válida (el caso que se
-- quiso tapar entonces) COMO a mp-webhook/mp-process-payment, que la
-- llaman con la service role key (sin sesión de usuario, is_admin()
-- siempre da falso ahí). Resultado: cuando Mercado Pago rechazaba un
-- pago, mp_payment_status quedaba en 'rejected' pero la orden nunca
-- pasaba a estado='rechazado' — se quedaba pegada en "pendiente_pago"
-- para siempre. Este bug ya existía con flow-webhook (mismo patrón,
-- nunca detectado porque Flow jamás llegó a procesar un pago
-- rechazado real).
--
-- service_role ya tenía GRANT EXECUTE desde la parte 19 — el problema
-- nunca fue el permiso de tabla, sino el chequeo interno de la
-- función. Fix: is_admin() solo se exige cuando el que llama NO es
-- service_role.
-- ============================================================

CREATE OR REPLACE FUNCTION rechazar_orden(p_orden_id uuid, p_nota text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND NOT is_admin() THEN RAISE EXCEPTION 'no_autorizado'; END IF;
  UPDATE ordenes
  SET estado = 'rechazado', notas_admin = p_nota
  WHERE id = p_orden_id AND estado = 'pendiente_pago';
  IF NOT FOUND THEN RAISE EXCEPTION 'orden_no_encontrada_o_ya_procesada'; END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
