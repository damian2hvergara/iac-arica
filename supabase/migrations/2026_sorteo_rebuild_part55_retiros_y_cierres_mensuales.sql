-- ============================================================
-- IAC ARICA 2026 — Parte 55
-- Dos ajustes al módulo de Finanzas (parte 53) pedidos por el usuario:
--
-- 1. Retiros de socios: cashflow-wise se comportan como un gasto (bajan
--    la plata disponible), pero tributariamente NO son un gasto
--    deducible — no reducen la utilidad tributaria ni el IDPC de la
--    empresa, son un reparto de utilidad ya generada. Por eso van en una
--    tabla separada de `costos`, nunca mezclados: si contaran como
--    costo, alguien podría interpretar mal que bajan el IDPC.
--
-- 2. Cierres mensuales: el Resumen calcula IVA/PPM en vivo como
--    ESTIMACIÓN — pero lo que realmente se paga cada mes por F29 puede
--    variar un poco. Esta tabla guarda el monto real pagado una vez que
--    el mes se cierra, como registro histórico fijo, separado de la
--    estimación en vivo.
-- ============================================================

-- --- 1. Retiros de socios ---------------------------------------------
CREATE TABLE retiros_socios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id        uuid NOT NULL REFERENCES socios(id) ON DELETE RESTRICT,
  fecha           date NOT NULL DEFAULT CURRENT_DATE,
  monto           integer NOT NULL CHECK (monto > 0),
  descripcion     text,
  registrado_por  text DEFAULT lower(COALESCE(auth.jwt() ->> 'email', '')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE retiros_socios ENABLE ROW LEVEL SECURITY;
CREATE POLICY retiros_socios_admin_all ON retiros_socios FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE INDEX retiros_socios_fecha_idx ON retiros_socios(fecha);
-- Grant explícito a los dos roles reales que lo van a usar — la lección
-- de hoy (partes 50-54): nunca asumir que "debería" alcanzar con la RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON retiros_socios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON retiros_socios TO service_role;

-- --- 2. Cierres mensuales (IVA/PPM realmente pagados) -----------------
CREATE TABLE cierres_mensuales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anio            integer NOT NULL,
  mes             integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  iva_pagado      integer NOT NULL DEFAULT 0 CHECK (iva_pagado >= 0),
  ppm_pagado      integer NOT NULL DEFAULT 0 CHECK (ppm_pagado >= 0),
  fecha_pago      date,
  nota            text,
  registrado_por  text DEFAULT lower(COALESCE(auth.jwt() ->> 'email', '')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(anio, mes)
);
ALTER TABLE cierres_mensuales ENABLE ROW LEVEL SECURITY;
CREATE POLICY cierres_mensuales_admin_all ON cierres_mensuales FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
GRANT SELECT, INSERT, UPDATE, DELETE ON cierres_mensuales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON cierres_mensuales TO service_role;

-- --- 3. resumen_financiero — se agregan retiros y pagos reales --------
-- Cambia el tipo de retorno, hay que hacer DROP primero (mismo caso que
-- la parte 49 con estado_orden_publico — CREATE OR REPLACE no permite
-- cambiar las columnas de un RETURNS TABLE).
DROP FUNCTION IF EXISTS resumen_financiero(date, date);

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
  iva_pagado_real                integer,
  ppm_estimado                  integer,
  ppm_pagado_real                integer,
  idpc_anual_proyectado         integer,
  utilidad_disponible_estimada  integer,
  retiros_socios                 integer,
  efectivo_disponible_tras_retiros integer
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
  v_iva_real integer;
  v_ppm      integer;
  v_ppm_real integer;
  v_idpc     integer;
  v_disponible integer;
  v_retiros  integer;
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

  SELECT COALESCE(SUM(monto), 0)::integer INTO v_retiros
  FROM retiros_socios
  WHERE (p_desde IS NULL OR fecha >= p_desde)
    AND (p_hasta IS NULL OR fecha <= p_hasta);

  -- Pagos reales de cierres_mensuales: se prorratea por mes calendario
  -- dentro del rango pedido (un cierre es de un mes completo, así que si
  -- el rango pedido cae parcialmente dentro de un mes, igual se cuenta
  -- completo — es una aproximación razonable para un resumen por
  -- período, no para reconciliación contable exacta).
  SELECT COALESCE(SUM(iva_pagado), 0)::integer, COALESCE(SUM(ppm_pagado), 0)::integer
    INTO v_iva_real, v_ppm_real
  FROM cierres_mensuales
  WHERE (p_desde IS NULL OR make_date(anio, mes, 1) >= date_trunc('month', p_desde)::date)
    AND (p_hasta IS NULL OR make_date(anio, mes, 1) <= date_trunc('month', p_hasta)::date);

  v_iva_deb  := ROUND(v_ingresos - (v_ingresos / 1.19))::integer;
  v_iva_cred := ROUND(v_credito_base - (v_credito_base / 1.19))::integer;
  v_iva_neto := GREATEST(0, v_iva_deb - v_iva_cred);

  v_ppm  := ROUND(v_ingresos * 0.0025)::integer;
  v_idpc := GREATEST(0, ROUND((v_ingresos - v_cf - v_cv) * 0.125))::integer;
  v_disponible := (v_ingresos - v_cf - v_cv - v_iva_neto - v_ppm);

  RETURN QUERY SELECT
    v_ingresos, v_cf, v_cv, (v_cf + v_cv),
    (v_ingresos - v_cf - v_cv),
    v_iva_deb, v_iva_cred, v_iva_neto, v_iva_real,
    v_ppm, v_ppm_real,
    v_idpc,
    v_disponible,
    v_retiros,
    (v_disponible - v_retiros);
END;
$$;
REVOKE ALL ON FUNCTION resumen_financiero(date, date) FROM public;
GRANT EXECUTE ON FUNCTION resumen_financiero(date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
