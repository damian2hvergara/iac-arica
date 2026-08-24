/**
 * create-pending-order — IAC Arica 2026
 *
 * Reemplaza la llamada RPC directa a create_pending_order() que hacía
 * el navegador con la anon key. Esa función perdió el EXECUTE de
 * "anon" tres veces en un mismo día (23-ago-2026, "permission denied",
 * código Postgres 42501) sin causa confirmada — ni revisando los
 * Postgres Logs apareció un REVOKE explícito — bloqueando compradores
 * reales cada vez (ver 05-Progreso/2026-08-23.md).
 *
 * Esta función intermedia llama a create_pending_order() con la
 * SERVICE_ROLE_KEY en vez de la anon key. El service role de Postgres
 * tiene bypassrls y no depende de ningún GRANT explícito sobre la
 * función — así que la clase de bug completa (grant de anon
 * desapareciendo) queda eliminada por diseño, no solo mitigada con
 * reintentos.
 *
 * Secrets necesarios: ninguno nuevo — SUPABASE_URL y
 * SUPABASE_SERVICE_ROLE_KEY ya están disponibles en toda Edge Function
 * de Supabase.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logEvent } from '../_shared/log-event.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const { nombre, email, telefono, rutPasaporte, packSlug, referidoPor } = body;
  if (!nombre || !email || !telefono || !rutPasaporte || !packSlug) {
    return json({ error: 'faltan_datos' }, 400);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data, error } = await supabase.rpc('create_pending_order', {
    p_nombre: nombre,
    p_email: email,
    p_telefono: telefono,
    p_rut_pasaporte: rutPasaporte,
    p_pack_slug: packSlug,
    p_referido_por: referidoPor || null,
  });

  if (error) {
    // nombre_invalido / telefono_invalido / rut_invalido / sorteo_no_activo,
    // etc. son validación de negocio esperable — no ameritan alertar al
    // dueño. Cualquier otra cosa (conexión, permisos, error inesperado de
    // Postgres) sí, porque con service role no debería pasar nunca.
    const codigosEsperados = ['nombre_invalido', 'telefono_invalido', 'rut_invalido'];
    if (!codigosEsperados.includes(error.message)) {
      await logEvent(supabase, {
        category: 'error', severity: 'critical', source: 'create-pending-order',
        message: 'create_pending_order falló con service role — no debería depender de grants de anon.',
        detail: { code: error.code, mensaje: error.message },
      });
    }
    return json({ error: error.message, code: error.code }, 400);
  }

  return json((data && data[0]) || {}, 200);
});
