/**
 * mp-create-preference — IAC Arica 2026
 *
 * Reemplaza a flow-create-payment (Flow.cl quedó descontinuado en este
 * proyecto). Crea una preferencia de pago en Mercado Pago para una
 * orden ya existente (creada antes vía create_pending_order) y
 * devuelve el preferenceId que el frontend usa para montar el Payment
 * Brick embebido en el mismo checkout — a diferencia de Flow, acá no
 * hay redirect a un dominio externo.
 *
 * stamper.html llama esta función directo para cualquier visitante sin
 * el link de pruebas (?modo_prueba=) — en el momento en que
 * MP_ACCESS_TOKEN esté configurada, el cobro real se activa para todo
 * el mundo.
 *
 * Secrets necesarios (Supabase → Edge Functions → Secrets):
 *   MP_ACCESS_TOKEN → access token de la app IAC-ARICA (prueba o
 *                      producción según la etapa del panel de MP)
 *
 * Referencia: https://www.mercadopago.cl/developers/es/reference/preferences/_checkout_preferences/post
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

  const { ordenId } = body;
  if (!ordenId) return json({ error: 'Falta ordenId' }, 400);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
  if (!MP_ACCESS_TOKEN) {
    await logEvent(supabase, {
      category: 'payment', severity: 'critical', source: 'mp-create-preference',
      message: 'Mercado Pago no está configurado (falta MP_ACCESS_TOKEN) — nadie puede pagar.',
      orderId: ordenId,
    });
    return json({ error: 'Mercado Pago no está configurado (falta MP_ACCESS_TOKEN como secret).' }, 500);
  }

  const { data: orden, error } = await supabase
    .from('ordenes')
    .select('id, email, nombre, rut_pasaporte, monto_total, cantidad_stickers, estado, pack_id, packs_config(nombre)')
    .eq('id', ordenId)
    .single();

  if (error || !orden) return json({ error: 'orden_no_encontrada' }, 404);
  if (orden.estado !== 'pendiente_pago') return json({ error: 'orden_ya_procesada' }, 400);

  const title = orden.packs_config?.nombre
    ? `Sticker Digital IAC Arica — ${orden.packs_config.nombre} (${orden.cantidad_stickers} stickers)`
    : 'Sticker Digital IAC Arica 2026';

  // Mercado Pago recomienda mandar toda la info disponible del comprador
  // (mejora la tasa de aprobación y el puntaje de "medición de calidad" de
  // la integración) — se arma acá en vez de solo el email. rut_pasaporte
  // ya viene normalizado por normalizar_rut_pasaporte(): un RUT queda como
  // "XX.XXX.XXX-D", cualquier otra cosa (pasaporte) queda tal cual. Solo se
  // manda identification cuando matchea ese formato — para pasaporte se
  // prefiere omitirlo antes que adivinar mal el tipo de documento y
  // arriesgar que Mercado Pago rechace la preferencia completa.
  const payer: Record<string, unknown> = { email: orden.email };
  if (orden.nombre) {
    const partes = String(orden.nombre).trim().split(/\s+/);
    payer.name = partes[0];
    if (partes.length > 1) payer.surname = partes.slice(1).join(' ');
  }
  if (orden.rut_pasaporte && /^\d{1,2}\.\d{3}\.\d{3}-[\dK]$/i.test(orden.rut_pasaporte)) {
    payer.identification = { type: 'RUT', number: orden.rut_pasaporte.replace(/\./g, '') };
  }

  const preference = {
    // Un solo ítem por el monto total exacto de la orden — nunca
    // "precio por unidad × cantidad". Repartir monto_total entre
    // cantidad_stickers y redondear podía hacer que Mercado Pago
    // cobrara unos pesos distinto de lo que el comprador vio en
    // pantalla cuando la división no era exacta (ahora que no hay piso
    // legal de precio, cualquier combinación de precio/cantidad es
    // posible — antes los packs siempre daban una división exacta,
    // pero eso era casualidad, no una garantía).
    items: [{
      id: `sticker-${orden.id}`,
      title,
      quantity: 1,
      unit_price: orden.monto_total,
      currency_id: 'CLP',
    }],
    payer: { email: orden.email },
    external_reference: String(ordenId),
    metadata: { orden_id: ordenId },
    back_urls: {
      success: `https://iac-arica.cl/stamper.html?mp_return=1&orden=${ordenId}`,
      pending: `https://iac-arica.cl/stamper.html?mp_return=1&orden=${ordenId}`,
      failure: `https://iac-arica.cl/stamper.html?mp_return=1&orden=${ordenId}`,
    },
    auto_return: 'approved',
    notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
  };

  let mpRes: Response;
  try {
    mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'X-Idempotency-Key': `pref-${ordenId}`,
      },
      body: JSON.stringify(preference),
    });
  } catch (e: any) {
    console.error('Error de red llamando a Mercado Pago:', e);
    await logEvent(supabase, {
      category: 'payment', severity: 'high', source: 'mp-create-preference',
      message: 'No se pudo conectar con Mercado Pago para crear una preferencia de pago.',
      detail: { error: String(e?.message || e) }, orderId: ordenId,
    });
    return json({ error: 'mercadopago_unreachable' }, 502);
  }

  if (!mpRes.ok) {
    const errText = await mpRes.text();
    console.error('Mercado Pago /checkout/preferences error:', errText);
    await logEvent(supabase, {
      category: 'payment', severity: 'high', source: 'mp-create-preference',
      message: 'Mercado Pago rechazó la creación de una preferencia de pago.',
      detail: { status: mpRes.status, detalle: errText.slice(0, 500) }, orderId: ordenId,
    });
    return json({ error: 'mercadopago_create_failed', detail: errText }, 502);
  }

  const mpData = await mpRes.json();

  // No es necesario esperar este UPDATE antes de responder — mp_preference_id
  // es solo informativo (nada lo lee antes de que el comprador pague), así que
  // se guarda en segundo plano para no sumarle otro round-trip a la latencia
  // que el comprador sí percibe. EdgeRuntime.waitUntil asegura que la
  // promesa corra hasta el final aunque la respuesta ya se haya mandado —
  // sin esto el runtime podría cortar el isolate antes de que el UPDATE
  // llegue a Postgres.
  const guardarPreferenceId = supabase
    .from('ordenes').update({ mp_preference_id: mpData.id }).eq('id', ordenId)
    .then(({ error }) => { if (error) console.error('No se pudo guardar mp_preference_id:', error); });
  // @ts-ignore — EdgeRuntime es un global que provee Supabase Edge Functions, no Deno estándar
  EdgeRuntime.waitUntil(guardarPreferenceId);

  return json({ preferenceId: mpData.id, monto: orden.monto_total }, 200);
});
