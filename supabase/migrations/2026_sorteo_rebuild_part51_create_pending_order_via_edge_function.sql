-- ============================================================
-- IAC ARICA 2026 — Parte 51
-- create_pending_order() perdió el EXECUTE de "anon" tres veces en un
-- mismo día (23-ago-2026, "permission denied" / 42501, sin causa
-- confirmada — ver 05-Progreso/2026-08-23.md), bloqueando compradores
-- reales cada vez. En vez de seguir reaplicando el mismo GRANT cuando
-- vuelva a desaparecer, el frontend ahora pasa por la Edge Function
-- create-pending-order, que llama a esta función con la
-- SERVICE_ROLE_KEY en vez de la anon key.
--
-- HALLAZGO al probar el cambio: "service_role" TAMPOCO tenía EXECUTE
-- sobre esta función — daba el mismo 42501. Explicación probable de
-- fondo (recién entendida, no antes): la parte 47 corrió
-- "REVOKE ALL ... FROM public" para limpiar el permiso implícito
-- heredado por todos los roles vía el pseudo-rol PUBLIC, y después
-- solo volvió a otorgar EXECUTE a "anon" explícitamente — nunca a
-- "service_role". Si la función solo tenía acceso vía el grant a
-- PUBLIC (nunca un grant directo a service_role), ese REVOKE ALL dejó
-- a service_role sin acceso desde ese momento, sin que nadie lo haya
-- notado porque el cliente siempre llamaba con la anon key. Esto no
-- explica el parpadeo original de "anon" (que si tenía grant directo
-- y aun así fallaba intermitente), pero sí es un bug real aparte que
-- había que corregir para que este cambio funcionara.
--
-- Con esto: se le da a service_role el EXECUTE que le faltaba, y de
-- paso se le revoca a "anon" (ya no lo necesita, todo pasa por la
-- Edge Function) — así la única fuente de verdad del permiso es un
-- grant directo y explícito a service_role, no algo heredado de
-- PUBLIC que un REVOKE ALL futuro pueda volver a barrer sin querer.
-- ============================================================

GRANT EXECUTE ON FUNCTION create_pending_order(text, text, text, text, text, text) TO service_role;
REVOKE ALL ON FUNCTION create_pending_order(text, text, text, text, text, text) FROM anon;

NOTIFY pgrst, 'reload schema';
