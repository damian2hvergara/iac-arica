/**
 * report-client-error — IAC Arica 2026
 *
 * El comprador no tiene sesión, así que esta función es pública por
 * diseño (mismo criterio que lookup-order/lookup-stickers-by-email) —
 * el control de abuso es por FORMA del payload y frecuencia, no por
 * autenticación. Existe para que un error del checkout que hoy solo
 * se ve en la consola del navegador del visitante (como pasó varias
 * veces con "permission denied for function create_pending_order")
 * le llegue al dueño por correo en vez de perderse.
 *
 * `errorType` es una lista fija — cualquier otro valor se rechaza, así
 * esto no se puede usar como buzón genérico de spam.
 *
 * Secrets necesarios: los mismos que send-alert-email (vía log-event.ts).
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

const ERROR_TYPES = new Set([
  'create_pending_order_failed',
  'flow_payment_init_failed',
  'test_simulate_failed',
  'unexpected_exception',
]);

// Códigos que create_pending_order() lanza a propósito por datos mal
// escritos — no son un bug, son el comprador equivocándose en un campo.
const VALIDACIONES_ESPERADAS = new Set([
  'nombre_invalido', 'email_invalido', 'telefono_invalido',
  'rut_invalido', 'pack_invalido', 'sorteo_no_activo',
]);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const contentLength = Number(req.headers.get('content-length') || '0');
  if (contentLength > 4096) return json({ ok: false, error: 'payload_too_large' }, 413);

  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400);
  }
  if (rawBody.length > 4096) return json({ ok: false, error: 'payload_too_large' }, 413);

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const errorType = String(body?.errorType || '');
  if (!ERROR_TYPES.has(errorType)) return json({ ok: false, error: 'errorType_no_reconocido' }, 400);

  const code = String(body?.code || '').slice(0, 200);
  const message = String(body?.message || '').slice(0, 500);
  const email = typeof body?.email === 'string' ? body.email.slice(0, 200) : null;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocida';

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // --- Límite de frecuencia (no hay infraestructura de rate-limit en
  // el proyecto, así que se cuenta contra los propios eventos ya
  // guardados). Se descarta en silencio, sin devolver una señal de
  // "te bloqueé".
  const { count: porIp } = await supabase
    .from('system_events')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'report-client-error')
    .contains('detail', { ip })
    .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
  if ((porIp ?? 0) >= 20) return json({ ok: true }, 200);

  if (email) {
    const { count: porEmail } = await supabase
      .from('system_events')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'report-client-error')
      .contains('detail', { email })
      .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());
    if ((porEmail ?? 0) >= 5) return json({ ok: true }, 200);
  }

  const detail = { errorType, code, message, email, ip };

  if (errorType === 'create_pending_order_failed' && VALIDACIONES_ESPERADAS.has(code)) {
    // Typo del comprador, no un bug — se guarda a baja severidad solo
    // para el conteo de frecuencia de arriba, sin mandar correo.
    await logEvent(supabase, {
      category: 'info', severity: 'low', source: 'report-client-error',
      message: 'Validación esperada del checkout (no es un error real).', detail,
    });
    return json({ ok: true }, 200);
  }

  if (errorType === 'create_pending_order_failed' && code === 'tope_legal_alcanzado') {
    await logEvent(supabase, {
      category: 'payment', severity: 'high', source: 'report-client-error',
      message: 'El tope legal de estampillas está bloqueando nuevas compras.', detail,
    });
    return json({ ok: true }, 200);
  }

  if (errorType === 'flow_payment_init_failed') {
    await logEvent(supabase, {
      category: 'payment', severity: 'high', source: 'report-client-error',
      message: 'Un comprador no pudo iniciar el pago con Flow.', detail,
    });
    return json({ ok: true }, 200);
  }

  if (errorType === 'test_simulate_failed') {
    await logEvent(supabase, {
      category: 'error', severity: 'medium', source: 'report-client-error',
      message: 'Falló una simulación en la ventana de pruebas.', detail,
    });
    return json({ ok: true }, 200);
  }

  // unexpected_exception, o create_pending_order_failed con un código
  // no reconocido (ej. "permission denied...") — la clase de bug que
  // antes solo se veía pegando la consola del navegador en el chat.
  await logEvent(supabase, {
    category: 'error', severity: 'critical', source: 'report-client-error',
    message: 'Error inesperado en el checkout — un comprador puede estar bloqueado ahora mismo.', detail,
  });
  return json({ ok: true }, 200);
});
