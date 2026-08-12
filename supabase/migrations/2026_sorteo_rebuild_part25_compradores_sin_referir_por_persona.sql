-- ============================================================
-- IAC ARICA 2026 — Parte 25
-- compradores_sin_referir() agrupaba por ORDEN, no por PERSONA. Como
-- cada orden trae su propio codigo_referido, alguien con 2+ compras
-- completadas (ninguna referida todavía) recibía 2 correos de
-- recordatorio, cada uno con un link de referido distinto — confuso
-- para el comprador y duplica el envío. El resto del sistema trata la
-- identidad por email (mi-cuenta.html, mi_ranking_referidos), así que
-- esta función debe hacer lo mismo: agrupar por email, revisar TODOS
-- sus códigos, y mandar un solo recordatorio por persona.
-- ============================================================

CREATE OR REPLACE FUNCTION compradores_sin_referir()
RETURNS TABLE(nombre text, email text, codigo_referido text)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  WITH personas AS (
    SELECT
      lower(o.email)                       AS email,
      (array_agg(o.nombre ORDER BY o.created_at DESC))[1] AS nombre,
      array_agg(DISTINCT o.codigo_referido) AS codigos,
      MIN(o.created_at)                    AS primera_compra
    FROM ordenes o
    WHERE o.estado = 'completado'
    GROUP BY lower(o.email)
  )
  SELECT p.nombre, p.email, p.codigos[1] AS codigo_referido
  FROM personas p
  WHERE NOT EXISTS (
    SELECT 1 FROM ordenes r
    WHERE r.referido_por = ANY(p.codigos) AND r.estado = 'completado'
  )
  ORDER BY p.primera_compra ASC;
$$;
REVOKE ALL ON FUNCTION compradores_sin_referir() FROM public;
GRANT EXECUTE ON FUNCTION compradores_sin_referir() TO authenticated;

NOTIFY pgrst, 'reload schema';
