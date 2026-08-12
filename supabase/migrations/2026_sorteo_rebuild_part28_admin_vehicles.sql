-- ============================================================
-- IAC ARICA 2026 — Parte 28
-- Cierra un cabo suelto de la auditoría de seguridad (parte 27): esa
-- migración blindó ordenes/estampillas/packs_config/sorteo_config con
-- is_admin(), pero dejó sin verificar vehicles/vehicle_images/
-- customization_kits/kit_features — tablas más viejas, de antes del
-- sistema de sorteo, que index.html usa para el catálogo público.
--
-- Sus políticas de escritura (INSERT/UPDATE/DELETE) probablemente
-- decían "TO authenticated USING(true)" igual que las otras — con
-- el registro público ya cerrado esto ya no es explotable por
-- cualquiera, pero se pareja al mismo criterio is_admin() del resto
-- del panel, por las dudas.
--
-- Se busca preservar la lectura pública del catálogo (para que
-- index.html siga mostrando los autos): si la política que se borra
-- era del tipo "FOR ALL" (cubría lectura Y escritura en una sola),
-- se repone una política de solo-lectura para que nadie quede sin
-- poder ver el catálogo mientras tanto.
-- ============================================================

DO $$
DECLARE
  t   text;
  pol record;
BEGIN
  FOREACH t IN ARRAY ARRAY['vehicles','vehicle_images','customization_kits','kit_features']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND cmd <> 'SELECT'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, t);
    END LOOP;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t AND cmd IN ('SELECT','ALL')
    ) THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)', t || '_select_public', t);
    END IF;

    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())',
      t || '_admin_write', t
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- ── Verificación (correr después) ──
-- Debe mostrar, para cada una de estas 4 tablas, la policy pública de
-- SELECT (sin cambios) + la nueva "<tabla>_admin_write":
--   SELECT tablename, policyname, cmd, roles
--   FROM pg_policies
--   WHERE tablename IN ('vehicles','vehicle_images','customization_kits','kit_features')
--   ORDER BY tablename, cmd;
