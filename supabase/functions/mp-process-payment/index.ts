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

  // Red de seguridad: cualquier excepción no prevista de acá para abajo
  // (antes se escapaba como un 500 genérico de la plataforma, sin
  // rastro del motivo real) queda registrada en system_events con el
  // error real, en vez de perderse.
  try {
    return await procesarPago(req, ordenId, formData, supabase);
  } catch (e: any) {
    console.error('mp-process-payment: excepción no capturada:', e);
    await logEvent(supabase, {
      category: 'error', severity: 'critical', source: 'mp-process-payment',
      message: 'Excepción no capturada procesando un pago.',
      detail: { error: String(e?.message || e), stack: String(e?.stack || '').slice(0, 800) }, orderId: ordenId,
    });
    return json({ error: 'error_inesperado' }, 500);
  }
});

async function procesarPago(req: Request, ordenId: string, formData: any, supabase: any): Promise<Response> {

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
    .select('id, estado, nombre, monto_total, cantidad_stickers, pack_id, packs_config(nombre)')
    .eq('id', ordenId)
    .maybeSingle();
  if (errOrden || !orden) return json({ error: 'orden_no_encontrada' }, 404);
  if (orden.estado !== 'pendiente_pago') {
    return json({ status: 'ya_procesado' }, 200);
  }

  const titulo = orden.packs_config?.nombre
    ? `Sticker Digital IAC Arica — ${orden.packs_config.nombre}`
    : 'Sticker Digital IAC Arica 2026';

  // Campos que pide la "medición de calidad" de Mercado Pago para el
  // request de Pagos (distinto del de Preferencias, que ya se enriquece
  // en mp-create-preference) — bajan el rechazo de pagos por el motor
  // antifraude. Se arman acá con datos ya guardados en la orden, no con
  // lo que mande el cliente.
  const nombrePartes = orden.nombre ? String(orden.nombre).trim().split(/\s+/) : [];

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
        payer: {
          ...(formData?.payer || {}),
          ...(nombrePartes[0] ? { first_name: nombrePartes[0] } : {}),
          ...(nombrePartes.length > 1 ? { last_name: nombrePartes.slice(1).join(' ') } : {}),
        },
        external_reference: String(ordenId),
        metadata: { orden_id: ordenId },
        description: titulo,
        statement_descriptor: 'IAC ARICA',
        additional_info: {
          items: [{
            id: `sticker-${ordenId}`,
            title: titulo,
            description: titulo,
            quantity: 1,
            unit_price: orden.monto_total,
          }],
        },
        // Sin esto, Mercado Pago puede dejar el pago "in_process" en
        // revisión por tiempo indefinido en vez de resolverlo al toque
        // — con binary_mode el resultado SIEMPRE es approved o rejected,
        // nunca queda en limbo (lo que rompía la confirmación automática).
        binary_mode: true,
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
}
