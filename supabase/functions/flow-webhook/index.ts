/**
 * flow-webhook — IAC Arica 2026
 *
 * Esta es la URL que Flow llama solo cuando el pago de una orden
 * cambia de estado (urlConfirmation). Flow solo manda un "token" en
 * el POST — por seguridad, NUNCA se confía en el cuerpo del webhook
 * directamente: siempre se vuelve a consultar el estado real a Flow
 * (payment/getStatus) usando ese token antes de hacer cualquier cambio.
 *
 * Si el pago quedó "pagada" (status 2), confirma la orden con la
 * misma función confirmar_orden() que ya usa el panel admin — genera
 * los folios, aplica el bono de referido si corresponde — y dispara
 * los mismos correos (send-stamp-email, send-referral-email) que ya
 * están funcionando.
 *
 * NO ACTIVO todavía: nadie llama a esta URL mientras Flow no esté
 * conectado de verdad (FLOW_MODE='simulation' en stamper.html).
 *
 * Secrets necesarios: los mismos que flow-create-payment
 * (FLOW_API_KEY, FLOW_SECRET_KEY, FLOW_BASE_URL opcional).
 *
 * Referencia: https://developers.flow.cl/en/docs/tutorial-basics/status
 * status: 1 pendiente · 2 pagada · 3 rechazada · 4 anulada
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let token: string | null = null;
  try {
    const form = await req.formData();
    token = form.get('token')?.toString() ?? null;
  } catch {
    return new Response('Invalid body', { status: 400 });
  }
  if (!token) return new Response('Falta token', { status: 400 });

  const FLOW_API_KEY = Deno.env.get('FLOW_API_KEY');
  const FLOW_SECRET_KEY = Deno.env.get('FLOW_SECRET_KEY');
  const FLOW_BASE_URL = Deno.env.get('FLOW_BASE_URL') ?? 'https://sandbox.flow.cl/api';
  if (!FLOW_API_KEY || !FLOW_SECRET_KEY) return new Response('Flow no configurado', { status: 500 });

  const statusParams: Record<string, string> = { apiKey: FLOW_API_KEY, token };
  statusParams.s = await signParams(statusParams, FLOW_SECRET_KEY);
  const qs = new URLSearchParams(statusParams).toString();

  let flowData: any;
  try {
    const flowRes = await fetch(`${FLOW_BASE_URL}/payment/getStatus?${qs}`);
    if (!flowRes.ok) {
      console.error('Flow getStatus error:', await flowRes.text());
      return new Response('Error consultando estado', { status: 502 });
    }
    flowData = await flowRes.json();
  } catch (e: any) {
    console.error('Error de red consultando Flow:', e);
    return new Response('Flow unreachable', { status: 502 });
  }

  const ordenId = flowData.commerceOrder;
  const status = flowData.status;
  if (!ordenId) return new Response('commerceOrder ausente', { status: 400 });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  if (status === 2) {
    const { data: folios, error } = await supabase.rpc('confirmar_orden', { p_orden_id: ordenId });
    if (error) {
      // Flow puede reintentar el mismo webhook — si ya estaba confirmada, no es un error real.
      if (String(error.message).includes('orden_ya_procesada')) {
        return new Response('OK (ya procesada)', { status: 200 });
      }
      console.error('confirmar_orden error:', error);
      return new Response('Error confirmando orden', { status: 500 });
    }

    try {
      const { data: orden } = await supabase
        .from('ordenes')
        .select('*, packs_config(nombre)')
        .eq('id', ordenId)
        .single();
      const { data: sorteo } = await supabase
        .from('sorteo_config')
        .select('*, vehicles(name, vehicle_images(image_url, is_main, order_index))')
        .eq('activo', true)
        .limit(1)
        .maybeSingle();

      const vehicleImageRows = (sorteo?.vehicles?.vehicle_images || [])
        .slice()
        .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0));
      const vehicleImages = vehicleImageRows.map((i: any) => i.image_url);
      const vehicleImg = vehicleImageRows.find((i: any) => i.is_main)?.image_url || vehicleImages[0] || null;

      // Misma lógica que pickStickerImageForFolio en js/stamper-api.js —
      // la foto depende del folio, no de la posición, para que coincida
      // siempre con lo que se muestra en pantalla y en reenvíos.
      const pickImgForFolio = (folio: string) => {
        if (!vehicleImages.length || !folio) return vehicleImg;
        let hash = 0;
        for (let i = 0; i < folio.length; i++) {
          hash = (hash * 31 + folio.charCodeAt(i)) >>> 0;
        }
        return vehicleImages[hash % vehicleImages.length];
      };

      const estampillas = (folios || []).map((f: any) => ({
        folio: f.numero_folio,
        hash: f.hash_seguridad,
        imagenUrl: pickImgForFolio(f.numero_folio),
      }));

      const fechaStr = sorteo?.fecha_sorteo
        ? new Date(sorteo.fecha_sorteo).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'Por confirmar';

      const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
      const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

      await fetch(`${SUPABASE_URL}/functions/v1/send-stamp-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({
          nombre: orden.nombre,
          email: orden.email,
          estampillas,
          vehicleName: sorteo?.vehicles?.name || 'Vehículo',
          vehicleImg,
          fechaSorteo: fechaStr,
          pack: orden.packs_config?.nombre || '',
          monto: orden.monto_total,
          codigoReferido: orden.codigo_referido,
        }),
      }).catch((e) => console.warn('send-stamp-email falló:', e));

      if (orden.referido_por) {
        const { data: infoRows } = await supabase.rpc('info_referido', { p_codigo_referido: orden.referido_por });
        const info = infoRows && infoRows[0];
        if (info?.referente_email) {
          await fetch(`${SUPABASE_URL}/functions/v1/send-referral-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
            body: JSON.stringify({
              referenteEmail: info.referente_email,
              referenteNombre: info.referente_nombre,
              referidoNombre: orden.nombre,
              cantidadComprada: orden.cantidad_stickers,
              totalAcumulado: info.total_comprado,
              bonosGanados: info.bonos_ganados,
              faltanParaProximo: info.faltan_para_proximo,
              codigoReferido: orden.referido_por,
            }),
          }).catch((e) => console.warn('send-referral-email falló:', e));
        }
      }
    } catch (e) {
      // Si fallan los correos, la orden ya quedó confirmada igual —
      // no se debe hacer fallar el webhook por esto (Flow reintentaría
      // innecesariamente). Solo se deja registrado en los logs.
      console.error('Error armando/enviando correos post-confirmación:', e);
    }

    return new Response('OK', { status: 200 });
  }

  if (status === 3 || status === 4) {
    await supabase
      .rpc('rechazar_orden', { p_orden_id: ordenId, p_nota: `Flow: status=${status}` })
      .catch((e) => console.warn('rechazar_orden falló (puede que ya estuviera procesada):', e));
    return new Response('OK', { status: 200 });
  }

  // status 1 (pendiente) — todavía no hay nada que hacer.
  return new Response('OK', { status: 200 });
});
