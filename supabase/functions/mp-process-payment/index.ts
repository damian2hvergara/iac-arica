/**
 * mp-process-payment — IAC Arica 2026
 *
 * Recibe el formData que entrega el callback onSubmit del Payment
 * Brick (tarjeta tokenizada, medio de pago, cuotas, etc.) y crea el
 * pago real en Mercado Pago. Es la ruta SÍNCRONA de confirmación —
 * cuando el pago queda "approved" al toque, confirma la orden y
 * dispara los correos ahí mismo, sin esperar al webhook. Para pagos
 * que quedan "pending"/"in_process" (algunos medios tardan en
 * resolver), la confirmación real llega después vía mp-webhook.
 *
 * El frontend agrega `ordenId` al payload del Brick antes de mandarlo
 * acá — ese campo se separa del resto antes de reenviar a Mercado
 * Pago (la API de pagos no lo espera).
 *
 * Secrets necesarios: MP_ACCESS_TOKEN, más los mismos de siempre para
 * el correo (vía send-stamp-email/send-referral-email, ya blindadas a
 * service_role).
 *
 * Referencia: https://www.mercadopago.cl/developers/es/docs/checkout-bricks/payment-brick/integration-configuration
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logEvent } from '../_shared/log-event.ts';
import { confirmarPagoAprobado, marcarPagoRechazado } from '../_shared/mp-confirm.ts';

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
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_body' }, 400);
  }

  const { orden_id: ordenId, ...formData } = body;
  if (!ordenId) return json({ error: 'falta_orden_id' }, 400);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
  if (!MP_ACCESS_TOKEN) {
    await logEvent(supabase, {
      category: 'payment', severity: 'critical', source: 'mp-process-payment',
      message: 'Mercado Pago no está configurado (falta MP_ACCESS_TOKEN) — nadie puede pagar.',
      orderId: ordenId,
    });
    return json({ error: 'Mercado Pago no está configurado.' }, 500);
  }

  const { data: orden, error: errOrden } = await supabase
    .from('ordenes')
    .select('id, estado')
    .eq('id', ordenId)
    .maybeSingle();
  if (errOrden || !orden) return json({ error: 'orden_no_encontrada' }, 404);
  if (orden.estado !== 'pendiente_pago') {
    return json({ status: 'ya_procesado' }, 200);
  }

  let mpRes: Response;
  try {
    mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        ...formData,
        external_reference: String(ordenId),
        metadata: { orden_id: ordenId },
      }),
    });
  } catch (e: any) {
    console.error('Error de red creando el pago en Mercado Pago:', e);
    await logEvent(supabase, {
      category: 'payment', severity: 'high', source: 'mp-process-payment',
      message: 'No se pudo conectar con Mercado Pago para procesar un pago.',
      detail: { error: String(e?.message || e) }, orderId: ordenId,
    });
    return json({ error: 'mercadopago_unreachable' }, 502);
  }

  const mpData = await mpRes.json();

  if (!mpRes.ok) {
    console.error('Mercado Pago /v1/payments error:', mpData);
    await logEvent(supabase, {
      category: 'payment', severity: 'high', source: 'mp-process-payment',
      message: 'Mercado Pago rechazó la creación de un pago.',
      detail: { status: mpRes.status, detalle: JSON.stringify(mpData).slice(0, 500) }, orderId: ordenId,
    });
    return json({ error: 'mercadopago_payment_failed', detail: mpData }, 502);
  }

  const status: string = mpData.status;
  const paymentId: string = String(mpData.id);
  const paymentType: string | null = mpData.payment_type_id ?? null;

  if (status === 'approved') {
    const resultado = await confirmarPagoAprobado(supabase, {
      ordenId, mpPaymentId: paymentId, mpPaymentType: paymentType, source: 'mp-process-payment',
    });
    if (!resultado.ok) return json({ status: 'error', error: resultado.error }, 500);
    return json({ status: 'approved', folios: resultado.folios ?? [], alreadyProcessed: resultado.alreadyProcessed ?? false }, 200);
  }

  if (status === 'rejected' || status === 'cancelled') {
    await marcarPagoRechazado(supabase, {
      ordenId, mpPaymentId: paymentId, mpPaymentStatus: status, mpPaymentType: paymentType,
    });
    return json({ status: 'rejected', statusDetail: mpData.status_detail ?? null }, 200);
  }

  // pending / in_process / authorized / in_mediation — la resolución final
  // llega después vía mp-webhook, no se toca el estado de la orden todavía.
  await supabase.from('ordenes').update({
    mp_payment_id: paymentId, mp_payment_status: status, mp_payment_type: paymentType,
  }).eq('id', ordenId);

  return json({ status: 'pending' }, 200);
});
