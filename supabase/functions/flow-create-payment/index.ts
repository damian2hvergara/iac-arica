/**
 * flow-create-payment — IAC Arica 2026
 *
 * Crea el pago en Flow.cl para una orden ya existente (creada antes
 * vía create_pending_order) y devuelve la URL a la que hay que
 * redirigir al comprador para que pague.
 *
 * stamper.html llama esta función directo para cualquier visitante sin
 * el link de pruebas (?modo_prueba=) — no hay ningún interruptor
 * intermedio: en el momento en que FLOW_API_KEY/FLOW_SECRET_KEY estén
 * configuradas, el cobro real se activa para todo el mundo.
 *
 * Secrets necesarios (Supabase → Edge Functions → Secrets):
 *   FLOW_API_KEY     → apiKey de tu cuenta Flow
 *   FLOW_SECRET_KEY  → secretKey de tu cuenta Flow (nunca exponer al navegador)
 *   FLOW_BASE_URL    → opcional. Por defecto usa el sandbox de Flow;
 *                       cuando estés listo para cobrar de verdad,
 *                       poner "https://www.flow.cl/api"
 *
 * Referencia: https://developers.flow.cl/en/docs/tutorial-basics/create-order
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logEvent } from '../_shared/log-event.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Firma HMAC-SHA256 que exige Flow: parámetros ordenados alfabéticamente,
// concatenados como clave+valor+clave+valor..., firmados con la secretKey.
async function signParams(params: Record<string, string>, secretKey: string): Promise<string> {
  const sortedKeys = Object.keys(params).sort();
  const toSign = sortedKeys.map((k) => `${k}${params[k]}`).join('');
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(toSign));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
  }

  const { ordenId } = body;
  if (!ordenId) {
    return new Response(JSON.stringify({ error: 'Falta ordenId' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const FLOW_API_KEY = Deno.env.get('FLOW_API_KEY');
  const FLOW_SECRET_KEY = Deno.env.get('FLOW_SECRET_KEY');
  const FLOW_BASE_URL = Deno.env.get('FLOW_BASE_URL') ?? 'https://sandbox.flow.cl/api';

  if (!FLOW_API_KEY || !FLOW_SECRET_KEY) {
    await logEvent(supabase, {
      category: 'payment', severity: 'critical', source: 'flow-create-payment',
      message: 'Flow no está configurado (faltan FLOW_API_KEY/FLOW_SECRET_KEY) — nadie puede pagar.',
      orderId: ordenId,
    });
    return new Response(JSON.stringify({ error: 'Flow no está configurado (faltan FLOW_API_KEY / FLOW_SECRET_KEY como secrets).' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: orden, error } = await supabase
    .from('ordenes')
    .select('id, email, monto_total, estado')
    .eq('id', ordenId)
    .single();

  if (error || !orden) {
    return new Response(JSON.stringify({ error: 'orden_no_encontrada' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (orden.estado !== 'pendiente_pago') {
    return new Response(JSON.stringify({ error: 'orden_ya_procesada' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const referencia = 'IAC-ORD-' + String(ordenId).replace(/-/g, '').slice(0, 8).toUpperCase();

  const params: Record<string, string> = {
    apiKey: FLOW_API_KEY,
    commerceOrder: String(ordenId),
    subject: `Sticker Digital IAC Arica — ${referencia}`,
    currency: 'CLP',
    amount: String(Math.round(orden.monto_total)),
    email: orden.email,
    urlConfirmation: `${SUPABASE_URL}/functions/v1/flow-webhook`,
    urlReturn: `https://iac-arica.cl/stamper.html?flow_return=1&orden=${ordenId}`,
  };
  params.s = await signParams(params, FLOW_SECRET_KEY);

  let flowRes: Response;
  try {
    flowRes = await fetch(`${FLOW_BASE_URL}/payment/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
  } catch (e: any) {
    console.error('Error de red llamando a Flow:', e);
    await logEvent(supabase, {
      category: 'payment', severity: 'high', source: 'flow-create-payment',
      message: 'No se pudo conectar con Flow para iniciar un cobro.',
      detail: { error: String(e?.message || e) }, orderId: ordenId,
    });
    return new Response(JSON.stringify({ error: 'flow_unreachable' }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!flowRes.ok) {
    const errText = await flowRes.text();
    console.error('Flow payment/create error:', errText);
    await logEvent(supabase, {
      category: 'payment', severity: 'high', source: 'flow-create-payment',
      message: 'Flow rechazó la creación de un cobro.',
      detail: { status: flowRes.status, detalle: errText.slice(0, 500) }, orderId: ordenId,
    });
    return new Response(JSON.stringify({ error: 'flow_create_failed', detail: errText }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const flowData = await flowRes.json();

  await supabase
    .from('ordenes')
    .update({ flow_token: flowData.token, flow_order: String(flowData.flowOrder ?? '') })
    .eq('id', ordenId);

  return new Response(JSON.stringify({ redirectUrl: `${flowData.url}?token=${flowData.token}` }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
