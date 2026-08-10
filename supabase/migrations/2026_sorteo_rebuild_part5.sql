-- ============================================================
-- IAC ARICA 2026 — Parte 5
-- Permite elegir manualmente la "rareza" (Bronce/Plata/Oro) de cada
-- pack desde el admin, en vez de que se calcule solo automáticamente
-- por precio. Si se deja vacío, sigue calculándose automático.
-- Ejecutar después de las partes 1 a 4, en Supabase → SQL Editor.
-- ============================================================

ALTER TABLE packs_config ADD COLUMN IF NOT EXISTS rareza text;
ALTER TABLE packs_config DROP CONSTRAINT IF EXISTS rareza_valida;
ALTER TABLE packs_config ADD CONSTRAINT rareza_valida CHECK (rareza IS NULL OR rareza IN ('bronce','plata','oro'));
