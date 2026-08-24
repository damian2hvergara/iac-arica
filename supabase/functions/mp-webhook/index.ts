/**
 * mp-webhook — IAC Arica 2026
 *
 * Reemplaza a flow-webhook. Es la URL que Mercado Pago llama cuando el
 * estado de un pago cambia (notification_url de la preferencia,
 * configurada también en el panel de la app IAC-ARICA → Webhooks).
 * Cubre sobre todo los pagos que quedan "pending"/"in_process" en el
 * submit inicial (mp-process-payment) y se resuelven después.
 *
 * Por seguridad, igual que con Flow, NUNCA se confía en el cuerpo de
 * la notificación: siempre se vuelve a consultar el pago real contra
 * la API de Mercado Pago (GET /v1/payments/:id) antes de tocar nada.
 *
 * Mercado Pago no manda un JWT de Supabase — por eso esta función
 * tiene verify_jwt=false en supabase/config.toml (mismo motivo que
 * tenía flow-webhook antes).
 *
 * Secrets necesarios: MP_ACCESS_TOKEN.
 *
 * Referencia: https://www.mercadopago.cl/developers/es/docs/checkout-bricks/additional-content/your-integrations/notifications/webhooks
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logEvent } from '../_shared/log-event.ts';
import { confirmarPagoAprobado, marcarPagoRechazado } from '../_shared/mp-confirm.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(req.url);
  let type = url.searchParams.get('type') || url.searchParams.get('topic');
  let paymentId = url.searchParams.get('data.id') || url.searchParams.get('id');

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      type = body?.type || body?.topic || type;
      paymentId = body?.data?.id || paymentId;
    } catch {
      // Mercado Pago a veces solo manda query params (formato IPN viejo) — sin body es normal.
    }
  }

  // Solo interesan notificaciones de pago — otros tipos (merchant_order,
  // etc.) se responden OK sin hacer nada, para que MP no reintente.
  if (type !== 'payment' || !paymentId) {
    return json({ ok: true, ignored: true }, 200);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
  if (!MP_ACCESS_TOKEN) {
    await logEvent(supabase, {
      category: 'payment', severity: 'critical', source: 'mp-webhook',
      message: 'Mercado Pago no está configurado (falta MP_ACCESS_TOKEN) — no se pudo procesar una notificación de pago.',
    });
    return json({ ok: false, error: 'mercadopago_no_configurado' }, 500);
  }

  let mpData: any;
  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
    });
    if (!mpRes.ok) {
      const detalle = await mpRes.text();
      console.error('Mercado Pago GET /v1/payments error:', detalle);
      await logEvent(supabase, {
        category: 'payment', severity: 'high', source: 'mp-webhook',
        message: 'Mercado Pago respondió con error al consultar el estado de un pago.',
        detail: { status: mpRes.status, detalle: detalle.slice(0, 500), paymentId },
      });
      return json({ ok: false, error: 'error_consultando_pago' }, 502);
    }
    mpData = await mpRes.json();
  } catch (e: any) {
    console.error('Error de red consultando Mercado Pago:', e);
    await logEvent(supabase, {
      category: 'payment', severity: 'high', source: 'mp-webhook',
      message: 'No se pudo conectar con Mercado Pago para consultar el estado de un pago.',
      detail: { error: String(e?.message || e), paymentId },
    });
    return json({ ok: false, error: 'mercadopago_unreachable' }, 502);
  }

  const ordenId = mpData.external_reference || mpData.metadata?.orden_id;
  const status: string = mpData.status;
  if (!ordenId) return json({ ok: false, error: 'external_reference_ausente' }, 400);

  const { data: orden } = await supabase.from('ordenes').select('estado').eq('id', ordenId).maybeSingle();
  if (!orden) return json({ ok: false, error: 'orden_no_encontrada' }, 404);
  if (orden.estado !== 'pendiente_pago') {
    return json({ ok: true, confirmed: orden.estado === 'completado', alreadyProcessed: true, status }, 200);
  }

  if (status === 'approved') {
    // Ver mp-process-payment: misma lógica para el costo automático de
    // comisión de Mercado Pago (Finanzas, parte 53).
    const feeAmount: number = Array.isArray(mpData.fee_details)
      ? mpData.fee_details.reduce((acc: number, f: any) => acc + (Number(f?.amount) || 0), 0)
      : 0;
    const resultado = await confirmarPagoAprobado(supabase, {
      ordenId, mpPaymentId: String(mpData.id), mpPaymentType: mpData.payment_type_id ?? null, source: 'mp-webhook',
      mpFeeAmount: feeAmount,
    });
    return json({ ok: resultado.ok, confirmed: resultado.ok, status }, resultado.ok ? 200 : 500);
  }

  if (status === 'rejected' || status === 'cancelled') {
    await marcarPagoRechazado(supabase, {
      ordenId, mpPaymentId: String(mpData.id), mpPaymentStatus: status, mpPaymentType: mpData.payment_type_id ?? null,
    });
    return json({ ok: true, confirmed: false, status }, 200);
  }

  // pending / in_process / authorized — todavía no hay nada que confirmar.
  await supabase.from('ordenes').update({
    mp_payment_id: String(mpData.id), mp_payment_status: status, mp_payment_type: mpData.payment_type_id ?? null,
  }).eq('id', ordenId);
  return json({ ok: true, confirmed: false, status }, 200);
});
