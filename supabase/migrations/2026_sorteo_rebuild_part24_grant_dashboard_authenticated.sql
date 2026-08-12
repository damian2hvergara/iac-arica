-- ============================================================
-- IAC ARICA 2026 — Parte 24
-- "El dashboard no me aparece ningún dato": getDashboardStats() (en
-- js/stamper-api.js) llama al RPC stickers_vendidos_count() logueado
-- como admin (rol "authenticated"), pero la parte 19 solo le dio
-- EXECUTE a "anon" (lo usa también el contador público de stamper.html).
-- Al fallar ese RPC con 42501, getDashboardStats() lanza la excepción
-- y loadDashboard() no pinta absolutamente nada (no hay fallback).
-- ============================================================

GRANT EXECUTE ON FUNCTION stickers_vendidos_count(uuid) TO authenticated;

-- Reafirma también el grant de "Marketing de referidos" (mismo patrón
-- de reseteo silencioso) mientras se revisa esta parte del panel.
GRANT EXECUTE ON FUNCTION compradores_sin_referir() TO authenticated;

NOTIFY pgrst, 'reload schema';
