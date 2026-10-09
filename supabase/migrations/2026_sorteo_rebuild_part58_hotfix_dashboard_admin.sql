-- ============================================================
-- IAC ARICA 2026 — Parte 58 (HOTFIX urgente)
-- La parte 56 revocó stickers_vendidos_count/stickers_comprados_count
-- de "anon, authenticated" por confidencialidad (correcto para anon:
-- esas RPCs eran llamables por cualquiera con la anon key pública). El
-- error fue incluir también "authenticated" — el Dashboard de
-- stamper-admin.html (getDashboardStats() en js/stamper-api.js,
-- líneas 475/481) usa EXACTAMENTE estas dos funciones con la sesión
-- del admin para mostrar los KPIs, y es la pestaña que carga sola al
-- iniciar sesión. Resultado: el panel admin quedó roto para cualquier
-- admin real apenas entraba.
--
-- top_referidores y mi_ranking_referidos (las otras 2 de la parte 56)
-- NO se tocan acá — confirmado que stamper-admin.html no las usa en
-- ningún lado, solo las páginas públicas (stamper.html,
-- mis-referidos.html), así que revocarlas de authenticated/anon ahí
-- sigue siendo correcto.
-- ============================================================

GRANT EXECUTE ON FUNCTION stickers_vendidos_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION stickers_comprados_count(uuid) TO authenticated;
-- "anon" se mantiene revocado a propósito — ese era el hueco real de
-- confidencialidad (la anon key es pública, visible en js/config.js).

NOTIFY pgrst, 'reload schema';
