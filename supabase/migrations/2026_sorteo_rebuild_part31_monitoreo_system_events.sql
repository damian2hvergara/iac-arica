-- ============================================================
-- IAC ARICA 2026 — Parte 31
-- Sistema de monitoreo/alertas. Hasta ahora, si un pago fallaba, si
-- alguien intentaba vulnerar el sistema, o si un comprador tenía un
-- error, la única forma de enterarse era notarlo por accidente en el
-- panel admin o pegar el error de la consola del navegador. Se agrega
-- una tabla central de eventos + una función para escribir en ella,
-- que las Edge Functions (send-alert-email y las demás) van a usar
-- para avisar al dueño por correo cuando algo grave pasa.
--
-- Mismo criterio de admin_emails/is_admin() (parte 27): solo
-- service_role y esta función SECURITY DEFINER pueden escribir —
-- nadie puede inundar ni falsificar el log.
-- ============================================================

CREATE TABLE IF NOT EXISTS system_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now(),
  category    text NOT NULL CHECK (category IN ('error','payment','security','abuse','info')),
  severity    text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  source      text NOT NULL,
  message     text NOT NULL,
  detail      jsonb,
  order_id    uuid,
  notified_at timestamptz,
  resolved    boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by text
);
CREATE INDEX IF NOT EXISTS system_events_created_at_idx ON system_events (created_at DESC);
CREATE INDEX IF NOT EXISTS system_events_unresolved_idx ON system_events (resolved) WHERE resolved = false;

ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON system_events FROM anon, authenticated;

DROP POLICY IF EXISTS system_events_admin_select ON system_events;
CREATE POLICY system_events_admin_select ON system_events FOR SELECT TO authenticated USING (is_admin());
-- Sin policy de UPDATE para authenticated a propósito: "marcar resuelto"
-- pasa por marcar_evento_resuelto() (SECURITY DEFINER, abajo), que deja
-- registrado quién lo resolvió de forma confiable — no un UPDATE directo.

GRANT SELECT ON system_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON system_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE system_events_id_seq TO service_role;

CREATE OR REPLACE FUNCTION log_system_event(
  p_category text, p_severity text, p_source text, p_message text,
  p_detail jsonb DEFAULT NULL, p_order_id uuid DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id bigint;
BEGIN
  INSERT INTO system_events(category, severity, source, message, detail, order_id)
  VALUES (p_category, p_severity, p_source, left(p_message, 2000), p_detail, p_order_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION log_system_event(text, text, text, text, jsonb, uuid) FROM public;
GRANT EXECUTE ON FUNCTION log_system_event(text, text, text, text, jsonb, uuid) TO service_role;

-- Dedup: ¿ya se avisó por correo un evento de este mismo origen+categoría
-- en los últimos 30 minutos? Lo usan las Edge Functions antes de mandar
-- el correo de alerta, para no bombardear al dueño con la misma falla
-- repetida (ej. Flow caído un rato).
CREATE OR REPLACE FUNCTION hubo_alerta_reciente(p_source text, p_category text, p_minutos integer DEFAULT 30)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM system_events
    WHERE source = p_source AND category = p_category
      AND notified_at IS NOT NULL
      AND notified_at > now() - (p_minutos || ' minutes')::interval
  );
$$;
REVOKE ALL ON FUNCTION hubo_alerta_reciente(text, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION hubo_alerta_reciente(text, text, integer) TO service_role;

-- Cuenta de eventos "security" recientes de un mismo origen — usado para
-- la regla de "recién a partir del 3er intento en 10 minutos, avisar".
CREATE OR REPLACE FUNCTION contar_eventos_recientes(p_source text, p_category text, p_minutos integer DEFAULT 10)
RETURNS integer
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM system_events
  WHERE source = p_source AND category = p_category
    AND created_at > now() - (p_minutos || ' minutes')::interval;
$$;
REVOKE ALL ON FUNCTION contar_eventos_recientes(text, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION contar_eventos_recientes(text, text, integer) TO service_role;

-- Marcar un evento como resuelto desde el panel admin.
CREATE OR REPLACE FUNCTION marcar_evento_resuelto(p_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'no_autorizado'; END IF;
  UPDATE system_events
  SET resolved = true, resolved_at = now(), resolved_by = auth.email()
  WHERE id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION marcar_evento_resuelto(bigint) FROM public;
GRANT EXECUTE ON FUNCTION marcar_evento_resuelto(bigint) TO authenticated;

NOTIFY pgrst, 'reload schema';
