-- ============================================================
-- IAC ARICA 2026 — Parte 27 — Auditoría de seguridad
-- Prueba de penetración autorizada por el dueño del proyecto sobre su
-- propio sistema (2026-08-12). Hallazgos y correcciones:
--
-- 1. CRÍTICO — confirmar_orden_simulado(uuid) tenía EXECUTE para
--    "anon": cualquier visitante podía llamar create_pending_order +
--    confirmar_orden_simulado directo por REST (sin pasar por la UI)
--    y obtener estampillas reales, confirmadas, sin pagar nada.
--
-- 2. CRÍTICO — el registro público de Supabase Auth está habilitado
--    (verificado en vivo) y las políticas RLS de ordenes/estampillas/
--    packs_config/sorteo_config daban acceso total a CUALQUIER sesión
--    "authenticated" (USING(true)), sin distinguir admin real de
--    cualquiera que se registre gratis. Se agrega una tabla
--    admin_emails + función is_admin() y se reescriben esas políticas
--    para exigir que el email de la sesión esté en esa lista.
--    (Falta además deshabilitar el registro público desde el
--    dashboard de Supabase — eso no se puede hacer por SQL.)
--
-- 3. ALTO — info_referido(codigo) tenía EXECUTE para "anon" y
--    devolvía el email + nombre completo del referente dado SOLO su
--    código de referido — que es público a propósito (va en cada
--    link compartido). Cualquiera con un link ajeno podía obtener el
--    correo real de quien lo compartió. Se reemplaza el uso público
--    (banner "fulano te invitó") por una función nueva que solo
--    devuelve el nombre, sin email.
--
-- 4. ALTO — bonos_pendientes_notificacion(orden_id) tenía EXECUTE
--    para "anon": dado un orden_id, devolvía email/nombre/folios
--    reales del referente Y marcaba el aviso como "ya notificado" —
--    permitía tanto la misma fuga de datos que el punto 3 como
--    silenciar (sin querer o a propósito) el aviso real del bono.
--
-- 5. Refuerzo — rechazar_orden y compradores_sin_referir son
--    SECURITY DEFINER: bypasean RLS por diseño, así que el fix de
--    RLS del punto 2 NO las protege. Se les agrega el mismo chequeo
--    is_admin() adentro.
-- ============================================================

-- --- 1. Cerrar la compra gratis -------------------------------
REVOKE EXECUTE ON FUNCTION confirmar_orden_simulado(uuid) FROM anon;
-- Sin esto, mientras Flow no esté activo (FLOW_MODE='live'), el
-- checkout público queda sin forma de confirmarse solo — es la
-- consecuencia esperada de "solo Flow puede confirmar pagos".

-- --- 2. Identidad real de admin, no solo "está logueado" -------
CREATE TABLE IF NOT EXISTS admin_emails (
  email       text PRIMARY KEY,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_emails ENABLE ROW LEVEL SECURITY;
-- A propósito NO se crea ninguna policy ni GRANT para anon/authenticated:
-- solo se edita desde el SQL Editor (rol postgres) o service_role.
REVOKE ALL ON admin_emails FROM anon, authenticated;

INSERT INTO admin_emails (email) VALUES (lower('admin@iac-arica.cl'))
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_emails a
    WHERE a.email = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );
$$;
REVOKE ALL ON FUNCTION is_admin() FROM public;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

DROP POLICY IF EXISTS ordenes_admin_all ON ordenes;
CREATE POLICY ordenes_admin_all ON ordenes FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS estampillas_admin_all ON estampillas;
CREATE POLICY estampillas_admin_all ON estampillas FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS packs_config_admin_write ON packs_config;
CREATE POLICY packs_config_admin_write ON packs_config FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS sorteo_config_admin_read ON sorteo_config;
CREATE POLICY sorteo_config_admin_read ON sorteo_config FOR SELECT TO authenticated USING (is_admin());

-- --- 5. Refuerzo en RPCs SECURITY DEFINER (bypasean RLS) -------
CREATE OR REPLACE FUNCTION rechazar_orden(p_orden_id uuid, p_nota text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'no_autorizado'; END IF;
  UPDATE ordenes
  SET estado = 'rechazado', notas_admin = p_nota
  WHERE id = p_orden_id AND estado = 'pendiente_pago';
  IF NOT FOUND THEN RAISE EXCEPTION 'orden_no_encontrada_o_ya_procesada'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION compradores_sin_referir()
RETURNS TABLE(nombre text, email text, codigo_referido text)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'no_autorizado'; END IF;
  RETURN QUERY
  WITH personas AS (
    SELECT
      lower(o.email)                       AS email,
      (array_agg(o.nombre ORDER BY o.created_at DESC))[1] AS nombre,
      array_agg(DISTINCT o.codigo_referido) AS codigos,
      MIN(o.created_at)                    AS primera_compra
    FROM ordenes o
    WHERE o.estado = 'completado'
    GROUP BY lower(o.email)
  )
  SELECT p.nombre, p.email, p.codigos[1] AS codigo_referido
  FROM personas p
  WHERE NOT EXISTS (
    SELECT 1 FROM ordenes r
    WHERE r.referido_por = ANY(p.codigos) AND r.estado = 'completado'
  )
  ORDER BY p.primera_compra ASC;
END;
$$;
-- Nota: pasa de LANGUAGE sql (parte 25) a plpgsql — hace falta para
-- poder hacer el RAISE EXCEPTION de is_admin() de arriba.

-- --- 3. info_referido: separar lo público de lo privado --------
REVOKE EXECUTE ON FUNCTION info_referido(text) FROM anon, authenticated;
-- Se mantiene el grant a service_role (parte 15/19) — solo flow-webhook
-- lo sigue usando, server-side, para avisarle al referente por correo.

CREATE OR REPLACE FUNCTION referente_nombre_publico(p_codigo_referido text)
RETURNS TABLE(referente_nombre text)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT o.nombre
  FROM ordenes o
  WHERE o.codigo_referido = p_codigo_referido AND o.estado = 'completado'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION referente_nombre_publico(text) FROM public;
GRANT EXECUTE ON FUNCTION referente_nombre_publico(text) TO anon, authenticated;

-- --- 4. bonos_pendientes_notificacion: solo server-side --------
REVOKE EXECUTE ON FUNCTION bonos_pendientes_notificacion(uuid) FROM anon;
-- service_role ya lo tenía (parte 21) — sigue funcionando desde flow-webhook.

NOTIFY pgrst, 'reload schema';

-- ── Verificación (correr después y avisar si algo sale distinto) ──
-- Debe devolver SOLO 'admin@iac-arica.cl':
--   SELECT email FROM admin_emails;
-- Ambas deben devolver 0 filas (anon ya no tiene EXECUTE):
--   SELECT * FROM information_schema.role_routine_grants
--   WHERE grantee = 'anon' AND routine_name IN
--     ('confirmar_orden_simulado','info_referido','bonos_pendientes_notificacion');
