-- ============================================================
-- IAC ARICA 2026 — Parte 53
-- Módulo de Finanzas — arranca solo con el Sorteo (la Importadora no
-- vende todavía por el sitio, ver 00-Proyecto.md). Objetivo: visibilidad
-- real de ingresos vs costos y una ESTIMACIÓN de cuánto apartar para
-- impuestos — nunca reemplaza el cálculo real de un contador, ver
-- 05-Progreso/2026-08-23.md para el contexto completo de la decisión de
-- régimen tributario (Pro Pyme General, contabilidad completa).
-- ============================================================

-- --- 1. Socios (accionistas de CV North Capital SpA) ---------------
CREATE TABLE socios (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                  text NOT NULL,
  rut                     text,
  porcentaje_participacion numeric(5,2) CHECK (porcentaje_participacion >= 0 AND porcentaje_participacion <= 100),
  activo                  boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE socios ENABLE ROW LEVEL SECURITY;
CREATE POLICY socios_admin_all ON socios FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- --- 2. Costos (fijos y variables) -----------------------------------
CREATE TABLE costos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  tipo            text NOT NULL CHECK (tipo IN ('fijo', 'variable')),
  categoria       text NOT NULL CHECK (categoria IN (
                    'arriendo', 'sueldos', 'comision_mp', 'marketing',
                    'hosting_software', 'importacion', 'premio_sorteo',
                    'premio_ranking', 'legal_contable', 'otros'
                  )),
  descripcion     text,
  monto           integer NOT NULL CHECK (monto > 0),
  -- Solo lo que tiene factura genera Crédito Fiscal de IVA — sin esta
  -- distinción, la estimación de IVA a pagar quedaría mal calculada.
  con_factura     boolean NOT NULL DEFAULT false,
  -- Si un socio puso la plata de su bolsillo (cuenta corriente
  -- socio-empresa) en vez de pagarse desde la cuenta de la empresa.
  pagado_por      uuid REFERENCES socios(id) ON DELETE SET NULL,
  -- Se llena solo en los costos que genera el sistema automáticamente
  -- (comisión de Mercado Pago por venta) — null en todo lo cargado a mano.
  orden_id        uuid REFERENCES ordenes(id) ON DELETE SET NULL,
  origen          text NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual', 'automatico')),
  registrado_por  text DEFAULT lower(COALESCE(auth.jwt() ->> 'email', '')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE costos ENABLE ROW LEVEL SECURITY;
CREATE POLICY costos_admin_all ON costos FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE INDEX costos_fecha_idx ON costos(fecha);
CREATE INDEX costos_orden_id_idx ON costos(orden_id);

-- El backend (mp-confirm.ts) inserta el costo automático de comisión MP
-- con service_role — no necesita is_admin() ni sesión de usuario.
GRANT SELECT, INSERT, UPDATE, DELETE ON costos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON socios TO service_role;

-- --- 3. Resumen financiero (RPC admin-only) --------------------------
-- Tasas vigentes hoy (23-ago-2026), Ley 21.755 — transitorias, EDITAR
-- esta función cuando cambien: IDPC Pro Pyme 12,5% (2025-2027) → 15%
-- (2028) → 25% (2029 en adelante). PPM Pro Pyme 0,25% mensual (sube a
-- 0,5% si los ingresos anuales superan 50.000 UF). IVA 19% estándar.
--
-- IMPORTANTE — esto es una ESTIMACIÓN para planificación de caja, no un
-- cálculo tributario válido. El IDPC real se determina en la Operación
-- Renta anual (abril), tomando en cuenta ajustes tributarios que esta
-- función no conoce, y el PPM pagado durante el año se descuenta de ese
-- IDPC anual — por eso acá se muestran por separado, no restados uno del
-- otro (evita duplicar la resta de un mismo peso dos veces).
CREATE OR REPLACE FUNCTION resumen_financiero(p_desde date DEFAULT NULL, p_hasta date DEFAULT NULL)
RETURNS TABLE(
  ingresos_sorteo              integer,
  costos_fijos                 integer,
  costos_variables              integer,
  costos_total                  integer,
  utilidad_operativa            integer,
  iva_debito_estimado           integer,
  iva_credito_estimado          integer,
  iva_neto_estimado             integer,
  ppm_estimado                  integer,
  idpc_anual_proyectado         integer,
  utilidad_disponible_estimada  integer
)
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
DECLARE
  v_ingresos integer;
  v_cf       integer;
  v_cv       integer;
  v_credito_base integer;
  v_iva_deb  integer;
  v_iva_cred integer;
  v_iva_neto integer;
  v_ppm      integer;
  v_idpc     integer;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'no_autorizado';
  END IF;

  SELECT COALESCE(SUM(monto_total), 0)::integer INTO v_ingresos
  FROM ordenes
  WHERE estado = 'completado' AND tipo = 'comprado'
    AND (p_desde IS NULL OR created_at::date >= p_desde)
    AND (p_hasta IS NULL OR created_at::date <= p_hasta);

  SELECT COALESCE(SUM(monto), 0)::integer INTO v_cf
  FROM costos
  WHERE tipo = 'fijo'
    AND (p_desde IS NULL OR fecha >= p_desde)
    AND (p_hasta IS NULL OR fecha <= p_hasta);

  SELECT COALESCE(SUM(monto), 0)::integer INTO v_cv
  FROM costos
  WHERE tipo = 'variable'
    AND (p_desde IS NULL OR fecha >= p_desde)
    AND (p_hasta IS NULL OR fecha <= p_hasta);

  SELECT COALESCE(SUM(monto), 0)::integer INTO v_credito_base
  FROM costos
  WHERE con_factura = true
    AND (p_desde IS NULL OR fecha >= p_desde)
    AND (p_hasta IS NULL OR fecha <= p_hasta);

  -- Los montos guardados son IVA incluido (boleta/comprobante final al
  -- consumidor) — el IVA es la parte proporcional, no un 19% adicional.
  v_iva_deb  := ROUND(v_ingresos - (v_ingresos / 1.19))::integer;
  v_iva_cred := ROUND(v_credito_base - (v_credito_base / 1.19))::integer;
  v_iva_neto := GREATEST(0, v_iva_deb - v_iva_cred);

  v_ppm  := ROUND(v_ingresos * 0.0025)::integer;
  v_idpc := GREATEST(0, ROUND((v_ingresos - v_cf - v_cv) * 0.125))::integer;

  RETURN QUERY SELECT
    v_ingresos, v_cf, v_cv, (v_cf + v_cv),
    (v_ingresos - v_cf - v_cv),
    v_iva_deb, v_iva_cred, v_iva_neto,
    v_ppm, v_idpc,
    (v_ingresos - v_cf - v_cv - v_iva_neto - v_ppm);
END;
$$;
REVOKE ALL ON FUNCTION resumen_financiero(date, date) FROM public;
GRANT EXECUTE ON FUNCTION resumen_financiero(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
