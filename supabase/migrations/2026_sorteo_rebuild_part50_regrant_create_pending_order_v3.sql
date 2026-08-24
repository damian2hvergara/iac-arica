-- ============================================================
-- IAC ARICA 2026 — Parte 50 (HOTFIX urgente, TERCERA vez)
-- create_pending_order() volvió a perder el EXECUTE de "anon" el
-- 23-ago-2026, con al menos un comprador real bloqueado con
-- "permission denied for function create_pending_order" (código
-- Postgres 42501) antes de que se reprodujera la llamada manualmente
-- y funcionara de nuevo — mismo patrón "parpadeo" que la parte 47.
--
-- Causa de fondo TODAVÍA sin confirmar: ni revisando los Postgres
-- Logs del dashboard aparece un REVOKE explícito. Hipótesis pendiente
-- de descartar: que algún proceso (interno de Supabase, un restore,
-- una recarga de schema cache) recree la función vía DROP+CREATE en
-- vez de CREATE OR REPLACE — eso resetea todos los grants sin dejar
-- un REVOKE visible en los logs. Ver 05-Progreso/2026-08-23.md.
--
-- Idéntico a la parte 47 — se reaplica igual porque es la misma
-- función/firma y no hay evidencia de qué la resetea.
-- ============================================================

REVOKE ALL ON FUNCTION create_pending_order(text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION create_pending_order(text, text, text, text, text, text) TO anon;

NOTIFY pgrst, 'reload schema';
