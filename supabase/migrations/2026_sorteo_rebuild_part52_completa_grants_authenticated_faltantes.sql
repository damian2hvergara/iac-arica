-- ============================================================
-- IAC ARICA 2026 — Parte 52
-- Causa real del "permission denied" intermitente en
-- create_pending_order (partes 47/50/51) recién confirmada con los
-- Postgres Logs exportados: NO era un grant que desaparecía. Todas las
-- llamadas que fallaban traían un auth_user real (una sesión de
-- Supabase activa en ese navegador — casi seguro la propia sesión de
-- admin probando el checkout público en la misma pestaña); todas las
-- que funcionaban traían auth_user null (visitante anónimo real).
--
-- Con sesión activa, Supabase evalúa el rol como "authenticated", no
-- "anon" — y create_pending_order solo tenía grant a "anon" (nunca a
-- "authenticated"). No era un permiso que se perdía, era un permiso
-- que nunca existió para ese rol. Ver 05-Progreso/2026-08-23.md.
--
-- Se revisaron todas las funciones con grant a "anon" del proyecto
-- buscando el mismo patrón (REVOKE ALL FROM public + GRANT solo a
-- anon, sin authenticated). Aparecieron 3 con el mismo hueco — las 3
-- identifican al llamador por argumento (email+RUT, o un UUID de orden
-- no adivinable), nunca por auth.uid()/auth.role(), así que ampliar el
-- grant a "authenticated" no abre ningún acceso nuevo, solo deja de
-- romper a cualquiera que las llame con una sesión activa en el
-- navegador:
--   - mi_ranking_referidos(text, text) — desde que se creó (parte 20).
--   - estado_orden_publico(uuid) — pantalla "esperando confirmación"
--     del checkout; si el comprador tuviera sesión activa por algún
--     motivo, este polling fallaría justo después de pagar.
--   - confirmar_orden_simulado(uuid) — flujo de prueba (?modo_prueba=),
--     el más probable de chocar con esto en la práctica: quien prueba
--     el checkout normalmente ES quien tiene sesión de admin abierta.
-- ============================================================

GRANT EXECUTE ON FUNCTION mi_ranking_referidos(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION estado_orden_publico(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION confirmar_orden_simulado(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
