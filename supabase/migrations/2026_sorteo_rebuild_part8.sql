-- ============================================================
-- IAC ARICA 2026 — Parte 8
-- Permite elegir a mano qué foto del vehículo es la portada de cada
-- pack, en vez de que se asigne siempre automático por posición.
-- Si se deja vacío, sigue funcionando automático como antes.
-- Ejecutar después de las partes 1 a 7, en Supabase → SQL Editor.
-- ============================================================

ALTER TABLE packs_config ADD COLUMN IF NOT EXISTS imagen_url text;
