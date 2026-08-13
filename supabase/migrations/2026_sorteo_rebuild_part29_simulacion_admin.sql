-- ============================================================
-- IAC ARICA 2026 — Parte 29
-- La parte 27 le sacó a "anon" el permiso sobre confirmar_orden_simulado
-- (era el hueco de "compra gratis sin pagar"). Correcto, pero dejó sin
-- forma de probar el sistema completo mientras Flow no esté conectado.
--
-- Se agrega el permiso a "service_role" únicamente: la nueva Edge
-- Function admin-simulate-purchase (verificada contra admin_emails,
-- ver parte 27) es la única que puede usarlo, y solo para órdenes que
-- el propio admin decide simular manualmente desde el panel.
-- ============================================================

GRANT EXECUTE ON FUNCTION confirmar_orden_simulado(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
