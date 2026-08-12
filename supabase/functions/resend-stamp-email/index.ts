/**
 * resend-stamp-email — IAC Arica 2026
 * Reenvía el correo de confirmación de una orden ya completada, a
 * pedido del propio comprador desde mi-cuenta.html. Verifica
 * server-side (service role key) que el correo coincida con el dueño
 * de la orden antes de reenviar, y arma el mismo payload que arma
 * stamper.html al confirmar una compra, delegando el envío real a
 * send-stamp-email para no duplicar la plantilla del correo.
 * Secrets necesarios: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (ya
 * disponibles automáticamente en Edge Functions de Supabase).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Misma lógica que pickStickerImageForFolio en js/stamper-api.js — la
// foto de una estampilla depende de su folio, no de su posición, para
// que un reenvío siempre muestre la misma foto que el correo original.
function pickImageForFolio(images: string[], folio: string) {
  if (!images.length || !folio) return null;
  let hash = 0;
  for (let i = 0; i < folio.length; i++) {
    hash = (hash * 31 + folio.charCodeAt(i)) >>> 0;
  }
  return images[hash % images.length];
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'Método no permitido' }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: 'JSON inválido' }, 400);
  }

  const email = (body?.email || '').toString().trim().toLowerCase();
  const ordenId = (body?.ordenId || '').toString().trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !ordenId) {
    return jsonResponse({ ok: false, error: 'Faltan datos.' }, 400);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    const { data: orden, error: errOrden } = await supabase
      .from('ordenes')
      .select('id, nombre, email, estado, monto_total, vehicle_id, codigo_referido, sorteo_id, packs_config(nombre)')
      .eq('id', ordenId)
      .eq('email', email)
      .maybeSingle();

    if (errOrden) throw errOrden;
    if (!orden) return jsonResponse({ ok: false, error: 'No encontramos esa orden con ese correo.' }, 404);
    if (orden.estado !== 'completado') {
      return jsonResponse({ ok: false, error: 'Esta orden todavía no tiene el pago confirmado.' }, 400);
    }

    const { data: folios } = await supabase
      .from('estampillas')
      .select('numero_folio, hash_seguridad, es_bonus')
      .eq('orden_id', ordenId)
      .order('orden_en_pack', { ascending: true });

    if (!folios || !folios.length) {
      return jsonResponse({ ok: false, error: 'Esta orden no tiene estampillas emitidas.' }, 400);
    }

    let vehicleName = 'Vehículo';
    let vehicleImages: string[] = [];
    if (orden.vehicle_id) {
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('name, vehicle_images(image_url, order_index)')
        .eq('id', orden.vehicle_id)
        .maybeSingle();
      if (vehicle) {
        vehicleName = vehicle.name || vehicleName;
        vehicleImages = (vehicle.vehicle_images || [])
          .slice()
          .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
          .map((i: any) => i.image_url);
      }
    }

    let fechaSorteo = 'Por confirmar';
    if (orden.sorteo_id) {
      const { data: sorteo } = await supabase
        .from('sorteo_config')
        .select('fecha_sorteo')
        .eq('id', orden.sorteo_id)
        .maybeSingle();
      if (sorteo?.fecha_sorteo) {
        fechaSorteo = new Date(sorteo.fecha_sorteo).toLocaleDateString('es-CL', {
          day: 'numeric', month: 'long', year: 'numeric',
        });
      }
    }

    const estampillas = folios.map((f: any) => ({
      folio: f.numero_folio,
      hash: f.hash_seguridad,
      imagenUrl: pickImageForFolio(vehicleImages, f.numero_folio),
      esBonus: f.es_bonus,
    }));

    const sendRes = await fetch(`${SUPABASE_URL}/functions/v1/send-stamp-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        nombre: orden.nombre,
        email: orden.email,
        estampillas,
        vehicleName,
        vehicleImg: vehicleImages[0] || null,
        fechaSorteo,
        pack: (orden as any).packs_config?.nombre || '',
        monto: orden.monto_total,
        codigoReferido: orden.codigo_referido,
      }),
    });

    if (!sendRes.ok) {
      const err = await sendRes.text();
      console.error('resend-stamp-email: error delegando a send-stamp-email:', err);
      return jsonResponse({ ok: false, error: 'No pudimos reenviar el correo. Intenta de nuevo.' }, 500);
    }

    return jsonResponse({ ok: true }, 200);
  } catch (e) {
    console.error('resend-stamp-email error:', e);
    return jsonResponse({ ok: false, error: 'No pudimos reenviar el correo. Intenta de nuevo.' }, 500);
  }
});
