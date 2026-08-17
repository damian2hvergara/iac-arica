-- ============================================================
-- IAC ARICA 2026 — Parte 43 (HOTFIX urgente)
-- ordenes.modo_pago tenía DEFAULT 'flow' desde la parte 3 — la parte
-- 42 cambió el CHECK constraint (sacó 'flow', agregó 'mercadopago')
-- pero se le olvidó actualizar el DEFAULT de la columna. Como
-- create_pending_order() no especifica modo_pago en su INSERT (confía
-- en el default), toda orden nueva empezó a caer en 'flow' — un valor
-- que la constraint nueva ya no permite — y create_pending_order()
-- quedó rota para TODO el mundo, incluidas las compras reales.
-- Confirmado en vivo antes de este fix.
-- ============================================================

ALTER TABLE ordenes ALTER COLUMN modo_pago SET DEFAULT 'mercadopago';

NOTIFY pgrst, 'reload schema';
