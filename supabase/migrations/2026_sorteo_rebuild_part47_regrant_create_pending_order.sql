-- ============================================================
-- IAC ARICA 2026 — Parte 47 (HOTFIX urgente, reaplicado)
-- create_pending_order() perdió el EXECUTE de "anon" en algún momento
-- entre el 22-ago (funcionando en decenas de pruebas contra
-- producción) y el 23-ago 00:02 (primer comprador real bloqueado con
-- "permission denied for function create_pending_order", código
-- Postgres 42501). Es la MISMA función y firma que ya se otorgó en la
-- parte 41 — no hubo ningún cambio de esquema entre medio que
-- explique la pérdida del permiso; causa de fondo sin confirmar
-- todavía (se revisaron los Postgres Logs del dashboard sin encontrar
-- el REVOKE responsable). Ver 05-Progreso/2026-08-23.md.
--
-- Este archivo documenta el fix ya aplicado en vivo por el usuario
-- desde el SQL Editor — se agrega al repo como registro histórico y
-- para poder reaplicarlo rápido si se pierde una tercera vez.
-- ============================================================

REVOKE ALL ON FUNCTION create_pending_order(text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION create_pending_order(text, text, text, text, text, text) TO anon;

NOTIFY pgrst, 'reload schema';
