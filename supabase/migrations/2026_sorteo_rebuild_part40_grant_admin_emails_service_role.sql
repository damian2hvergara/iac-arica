-- ============================================================
-- IAC ARICA 2026 — Parte 40
-- admin_emails (creada en la parte 27) nunca recibió un GRANT
-- explícito para service_role — solo se revocó acceso a
-- anon/authenticated, asumiendo que service_role igual podría
-- leerla. is_admin() (SECURITY DEFINER) nunca lo notó porque corre
-- con los permisos de quien la creó, no con los del que la llama —
-- pero admin-simulate-purchase y send-referral-nudge SÍ consultan
-- admin_emails directo con la service role key, y chocaban con
-- "permission denied for table admin_emails" (código 42501),
-- silenciosamente interpretado como "no es admin" porque el código
-- no revisaba el error de esa consulta (ver fix aparte en el código
-- de ambas funciones). Confirmado en vivo con un admin real.
-- ============================================================

GRANT SELECT ON admin_emails TO service_role;

NOTIFY pgrst, 'reload schema';
