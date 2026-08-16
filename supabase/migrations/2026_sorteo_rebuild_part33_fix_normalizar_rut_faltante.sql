-- ============================================================
-- IAC ARICA 2026 — Parte 33 — URGENTE
-- Verificación en vivo detectó que create_pending_order está roto:
-- "function normalizar_rut_pasaporte(text) does not exist" — nadie
-- puede comprar en este momento. La función se creó en la parte 23 y
-- venía funcionando desde entonces; por qué desapareció no está claro
-- (mismo patrón nunca-explicado de este proyecto donde grants/objetos
-- se resetean solos — ver partes 10/19). Este script solo la vuelve a
-- crear, igual que en la parte 23, sin tocar nada más.
-- ============================================================

CREATE OR REPLACE FUNCTION normalizar_rut_pasaporte(p_valor text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_clean text;
  v_body  text;
  v_dv    text;
BEGIN
  v_clean := upper(regexp_replace(trim(p_valor), '[.[:space:]-]', '', 'g'));
  IF v_clean ~ '^[0-9]{7,8}[0-9K]$' THEN
    v_body := left(v_clean, length(v_clean) - 1);
    v_dv := right(v_clean, 1);
    RETURN reverse(regexp_replace(reverse(v_body), '([0-9]{3})(?=[0-9])', '\1.', 'g')) || '-' || v_dv;
  ELSE
    RETURN v_clean;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- ── Verificación (correr después) ──
-- Debe devolver "18.853.935-1":
--   SELECT normalizar_rut_pasaporte('188539351');
