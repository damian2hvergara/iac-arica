-- ============================================================
-- IAC ARICA 2026 — Parte 54
-- Aplicando la lección del incidente de hoy (partes 50/51/52): nunca
-- asumir que un rol tiene acceso porque "debería" — verificarlo
-- explícito. Se probó con la anon key contra costos/socios/
-- resumen_financiero (parte 53) y las tres dieron "permission denied
-- for table/function", NO "does not exist" — confirma que la parte 53
-- corrió bien, pero también confirma que este proyecto NO otorga
-- privilegios por defecto a los roles nuevos. La parte 53 solo le dio
-- privilegios explícitos a "service_role" sobre las tablas — a
-- "authenticated" nunca se le otorgó el GRANT de tabla (solo quedó la
-- policy de RLS, que no sirve de nada sin el GRANT de base debajo).
-- Sin este fix, ni siquiera el admin logueado podría usar finanzas.html.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON costos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON socios TO authenticated;

NOTIFY pgrst, 'reload schema';
