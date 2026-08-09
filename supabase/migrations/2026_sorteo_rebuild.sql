-- ============================================================
-- IAC ARICA 2026 — "NO SUEÑES, GÁNATELO"
-- Migración: rediseño de venta de Stickers Digitales
-- Ejecutar completo, en orden, en Supabase → SQL Editor.
--
-- IMPORTANTE antes de correr esto:
--   1. Respaldar la tabla actual `estampillas` si se quiere conservar
--      (son datos de prueba en modo simulación, la venta real
--      todavía no empieza — fecha de inicio 2026-08-21).
--   2. Este script hace DROP TABLE de la `estampillas` actual.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1. packs_config — reemplaza el precio hardcodeado en 3 lugares
--    (stamper.html data-*, JS default, PACK_PRECIO del admin)
-- ------------------------------------------------------------
CREATE TABLE packs_config (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               text UNIQUE NOT NULL,
  nombre             text NOT NULL,
  cantidad_stickers  integer NOT NULL CHECK (cantidad_stickers > 0),
  precio_total       integer NOT NULL CHECK (precio_total > 0),
  destacado          boolean NOT NULL DEFAULT false,
  activo             boolean NOT NULL DEFAULT true,
  orden              integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  -- Piso legal: nunca menos de $4.000 por unidad dentro de un pack
  CONSTRAINT precio_floor CHECK (precio_total >= cantidad_stickers * 4000)
);

ALTER TABLE packs_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY packs_config_select_public ON packs_config FOR SELECT USING (true);
CREATE POLICY packs_config_admin_write   ON packs_config FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO packs_config (slug, nombre, cantidad_stickers, precio_total, destacado, orden) VALUES
 ('individual',    'Estampilla Individual', 1,  5500,  false, 1),
 ('duo',            'Pack Dúo',              2, 10500,  false, 2),
 ('popular',        'Pack Popular',          5, 24500,  true,  3),
 ('coleccionista',  'Pack Coleccionista',   10, 45000,  false, 4),
 ('fanatico',       'Pack Fanático',        20, 80000,  false, 5);

-- ------------------------------------------------------------
-- 2. ordenes — la transacción comercial (nace "pendiente_pago")
-- ------------------------------------------------------------
CREATE TABLE ordenes (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre             text NOT NULL,
  email              text NOT NULL,
  telefono           text NOT NULL,
  rut_pasaporte      text NOT NULL,
  pack_id            uuid NOT NULL REFERENCES packs_config(id),
  cantidad_stickers  integer NOT NULL,
  monto_total        integer NOT NULL,
  modo_pago          text NOT NULL DEFAULT 'transferencia' CHECK (modo_pago IN ('transferencia', 'flow')),
  estado             text NOT NULL DEFAULT 'pendiente_pago' CHECK (estado IN ('pendiente_pago', 'completado', 'rechazado', 'reembolsado')),
  referido_por       text,
  codigo_referido    text UNIQUE NOT NULL DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 8),
  bono_aplicado      boolean NOT NULL DEFAULT false,
  notas_admin        text,
  sorteo_id          uuid REFERENCES sorteo_config(id),
  vehicle_id         uuid REFERENCES vehicles(id),
  confirmado_at      timestamptz,
  confirmado_por     text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ordenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY ordenes_admin_all ON ordenes FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON ordenes FROM anon;
-- anon NO tiene INSERT/SELECT directo aquí — solo vía create_pending_order() más abajo.

-- ------------------------------------------------------------
-- 3. estampillas — un número confirmado por sticker (rebuild)
-- ------------------------------------------------------------
-- resumen_sorteo es una vista antigua (no usada por ningún archivo de este
-- repo) que quedó apuntando a la tabla estampillas vieja. Como la tabla se
-- reemplaza por completo y el nuevo dashboard (stamper-admin.html) consulta
-- ordenes/estampillas directamente, no una vista, se elimina aquí.
DROP VIEW IF EXISTS resumen_sorteo;
DROP TABLE IF EXISTS estampillas;

CREATE TABLE estampillas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id        uuid NOT NULL REFERENCES ordenes(id),
  numero_folio    text NOT NULL UNIQUE,
  hash_seguridad  text NOT NULL,
  orden_en_pack   integer NOT NULL,
  es_bonus        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE estampillas ENABLE ROW LEVEL SECURITY;
CREATE POLICY estampillas_admin_all ON estampillas FOR ALL TO authenticated USING (true) WITH CHECK (true);
REVOKE ALL ON estampillas FROM anon;
-- anon NO tiene ningún acceso directo — cierra el XSS actual de raíz.

-- ------------------------------------------------------------
-- 4. sorteo_config — extender tabla existente
-- ------------------------------------------------------------
ALTER TABLE sorteo_config ADD COLUMN IF NOT EXISTS meta_minima_stickers      integer NOT NULL DEFAULT 6500;
ALTER TABLE sorteo_config ADD COLUMN IF NOT EXISTS total_stickers_emitidos   integer NOT NULL DEFAULT 10000;
ALTER TABLE sorteo_config ADD COLUMN IF NOT EXISTS fecha_venta_inicio        date;
ALTER TABLE sorteo_config ADD COLUMN IF NOT EXISTS fecha_venta_cierre        date;
ALTER TABLE sorteo_config ADD COLUMN IF NOT EXISTS zona_franca_texto         text;
ALTER TABLE sorteo_config ADD COLUMN IF NOT EXISTS extensiones_realizadas    integer NOT NULL DEFAULT 0;
ALTER TABLE sorteo_config ADD COLUMN IF NOT EXISTS ventana_reembolso_abierta boolean NOT NULL DEFAULT false;

-- meta_minima_stickers y total_stickers_emitidos NUNCA deben ser públicos:
REVOKE SELECT ON sorteo_config FROM anon;
DROP POLICY IF EXISTS "Lectura pública" ON sorteo_config;
CREATE POLICY sorteo_config_admin_read ON sorteo_config FOR SELECT TO authenticated USING (true);

-- Vista pública: solo columnas seguras.
CREATE OR REPLACE VIEW sorteo_publico AS
SELECT id, nombre_sorteo, descripcion, fecha_sorteo, fecha_venta_inicio, fecha_venta_cierre,
       vehicle_id, bases_url, activo, zona_franca_texto, ventana_reembolso_abierta
FROM sorteo_config;
GRANT SELECT ON sorteo_publico TO anon;

-- ------------------------------------------------------------
-- 5. Contador público de vendidos — sin denominador nunca
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION stickers_vendidos_count(p_sorteo_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM estampillas e
  JOIN ordenes o ON o.id = e.orden_id
  WHERE o.estado = 'completado'
    AND (p_sorteo_id IS NULL OR o.sorteo_id = p_sorteo_id);
$$;
REVOKE ALL ON FUNCTION stickers_vendidos_count(uuid) FROM public;
GRANT EXECUTE ON FUNCTION stickers_vendidos_count(uuid) TO anon;

-- ------------------------------------------------------------
-- 6. create_pending_order — única vía de escritura pública
--    (calcula el precio en el servidor, el cliente no lo puede tocar)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION create_pending_order(
  p_nombre text, p_email text, p_telefono text, p_rut_pasaporte text,
  p_pack_slug text, p_referido_por text DEFAULT NULL
) RETURNS TABLE(orden_id uuid, referencia text, monto_total integer, cantidad_stickers integer, codigo_referido text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pack   packs_config;
  v_sorteo sorteo_config;
  v_id     uuid;
  v_ref    text;
  v_codigo text;
BEGIN
  IF p_nombre IS NULL OR length(trim(p_nombre)) < 3 THEN RAISE EXCEPTION 'nombre_invalido'; END IF;
  IF p_email IS NULL OR p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'email_invalido'; END IF;
  IF p_telefono IS NULL OR length(trim(p_telefono)) < 8 THEN RAISE EXCEPTION 'telefono_invalido'; END IF;
  IF p_rut_pasaporte IS NULL OR length(trim(p_rut_pasaporte)) < 5 THEN RAISE EXCEPTION 'rut_invalido'; END IF;

  SELECT * INTO v_pack FROM packs_config WHERE slug = p_pack_slug AND activo = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'pack_invalido'; END IF;

  SELECT * INTO v_sorteo FROM sorteo_config WHERE activo = true LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'sorteo_no_activo'; END IF;

  -- Ignora silenciosamente códigos de referido inválidos/forjados
  IF p_referido_por IS NOT NULL AND NOT EXISTS
     (SELECT 1 FROM ordenes WHERE codigo_referido = p_referido_por) THEN
    p_referido_por := NULL;
  END IF;

  INSERT INTO ordenes (nombre, email, telefono, rut_pasaporte, pack_id, cantidad_stickers,
                        monto_total, referido_por, sorteo_id, vehicle_id)
  VALUES (trim(p_nombre), lower(trim(p_email)), p_telefono, p_rut_pasaporte, v_pack.id,
          v_pack.cantidad_stickers, v_pack.precio_total, p_referido_por, v_sorteo.id, v_sorteo.vehicle_id)
  RETURNING id, codigo_referido INTO v_id, v_codigo;

  v_ref := 'IAC-ORD-' || upper(substr(v_id::text, 1, 8));

  RETURN QUERY SELECT v_id, v_ref, v_pack.precio_total, v_pack.cantidad_stickers, v_codigo;
END;
$$;
REVOKE ALL ON FUNCTION create_pending_order(text, text, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION create_pending_order(text, text, text, text, text, text) TO anon;

-- ------------------------------------------------------------
-- 7. confirmar_orden — solo admin. Genera folios + bono referido.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION confirmar_orden(p_orden_id uuid)
RETURNS TABLE(numero_folio text, hash_seguridad text, orden_en_pack integer)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orden    ordenes%ROWTYPE;
  v_i        integer;
  v_folio    text;
  v_hash     text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sin O,0,I,1
BEGIN
  SELECT * INTO v_orden FROM ordenes WHERE id = p_orden_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'orden_no_encontrada'; END IF;
  IF v_orden.estado <> 'pendiente_pago' THEN RAISE EXCEPTION 'orden_ya_procesada'; END IF;

  FOR v_i IN 1..v_orden.cantidad_stickers LOOP
    LOOP
      v_folio := array_to_string(ARRAY(
        SELECT substr(v_alphabet, (floor(random() * 32) + 1)::int, 1)
        FROM generate_series(1, 8)), '');
      v_folio := 'IAC-' || substr(v_folio, 1, 4) || '-' || substr(v_folio, 5, 4);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM estampillas WHERE numero_folio = v_folio);
    END LOOP;

    v_hash := upper(substr(encode(
      digest(v_folio || '|' || v_orden.email || '|' || now()::text || '|IAC-ARICA-2026', 'sha256'), 'hex'
    ), 1, 16));

    INSERT INTO estampillas (orden_id, numero_folio, hash_seguridad, orden_en_pack)
    VALUES (p_orden_id, v_folio, v_hash, v_i);

    RETURN QUERY SELECT v_folio, v_hash, v_i;
  END LOOP;

  UPDATE ordenes
  SET estado = 'completado', confirmado_at = now(), confirmado_por = auth.email()
  WHERE id = p_orden_id;

  -- Bono de referido: 1 estampilla gratis al referente, una sola vez.
  IF v_orden.referido_por IS NOT NULL THEN
    DECLARE
      v_ref_orden ordenes%ROWTYPE;
      v_pos       integer;
    BEGIN
      SELECT * INTO v_ref_orden FROM ordenes
      WHERE codigo_referido = v_orden.referido_por AND bono_aplicado = false
      FOR UPDATE;

      IF FOUND THEN
        SELECT COALESCE(MAX(orden_en_pack), 0) + 1 INTO v_pos
        FROM estampillas WHERE orden_id = v_ref_orden.id;

        v_folio := 'IAC-BONUS-' || upper(substr(md5(random()::text), 1, 4));
        v_hash  := upper(substr(encode(digest(v_folio || '|bonus|' || now()::text, 'sha256'), 'hex'), 1, 16));

        INSERT INTO estampillas (orden_id, numero_folio, hash_seguridad, orden_en_pack, es_bonus)
        VALUES (v_ref_orden.id, v_folio, v_hash, v_pos, true);

        UPDATE ordenes SET bono_aplicado = true WHERE id = v_ref_orden.id;
      END IF;
    END;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION confirmar_orden(uuid) FROM public;
GRANT EXECUTE ON FUNCTION confirmar_orden(uuid) TO authenticated;

-- ------------------------------------------------------------
-- 8. rechazar_orden — solo admin.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION rechazar_orden(p_orden_id uuid, p_nota text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ordenes
  SET estado = 'rechazado', notas_admin = p_nota
  WHERE id = p_orden_id AND estado = 'pendiente_pago';
  IF NOT FOUND THEN RAISE EXCEPTION 'orden_no_encontrada_o_ya_procesada'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION rechazar_orden(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION rechazar_orden(uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- 9. Datos del sorteo activo — completar con los datos reales
-- ------------------------------------------------------------
-- Ejecutar DESPUÉS de cargar el Dodge Challenger 2018 como fila en `vehicles`
-- y de tener una fila activa en `sorteo_config` (usar el flujo ya existente
-- en stamper-admin.html → tab "Configuración del sorteo").
--
-- UPDATE sorteo_config SET
--   fecha_venta_inicio = '2026-08-21',
--   fecha_venta_cierre = '2026-09-20',
--   meta_minima_stickers = 6500,
--   total_stickers_emitidos = 10000,
--   zona_franca_texto = 'El vehículo fue internado bajo régimen de Zona Franca, por lo que solo puede circular libremente en la Región de Arica y Parinacota. Liberarlo para circular en el resto de Chile es un trámite y costo exclusivo del ganador; IAC Arica no garantiza plazos ni valores de ese proceso.'
-- WHERE activo = true;
