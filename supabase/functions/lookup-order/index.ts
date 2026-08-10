/**
 * lookup-order — IAC Arica 2026
 * Búsqueda segura de una orden para "mi-cuenta.html".
 * Requiere email + identificador (referencia de orden o folio de sticker) —
 * nunca solo email, para evitar enumeración de compras ajenas.
 * Usa la service role key (nunca expuesta al browser) para saltarse RLS
 * y hacer el match server-side.
 * Secrets necesarios: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (ya disponibles
 * automáticamente en Edge Functions de Supabase).
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

const NOT_FOUND = { ok: false, error: 'No encontramos una orden con esos datos.' };

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
  const identificador = (body?.identificador || '').toString().trim().toUpperCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !identificador) {
    return jsonResponse(NOT_FOUND, 404);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const esFolio = /^IAC-[A-Z0-9]{4,}-[A-Z0-9]{4,}$/.test(identificador) || identificador.startsWith('IAC-BONUS-');
  const esReferencia = /^IAC-ORD-[A-Z0-9]{8}$/.test(identificador);

  if (!esFolio && !esReferencia) {
    return jsonResponse(NOT_FOUND, 404);
  }

  try {
    let ordenId: string | null = null;

    if (esReferencia) {
      const shortId = identificador.replace('IAC-ORD-', '').toLowerCase();
      const { data: ordenes } = await supabase
        .from('ordenes')
        .select('id, email')
        .eq('email', email);
      const match = (ordenes || []).find((o: any) => o.id.replace(/-/g, '').toUpperCase().startsWith(shortId.toUpperCase()));
      if (match) ordenId = match.id;
    } else {
      const { data: estampilla } = await supabase
        .from('estampillas')
        .select('orden_id')
        .eq('numero_folio', identificador)
        .maybeSingle();
      if (estampilla) {
        const { data: orden } = await supabase
          .from('ordenes')
          .select('id')
          .eq('id', estampilla.orden_id)
          .eq('email', email)
          .maybeSingle();
        if (orden) ordenId = orden.id;
      }
    }

    if (!ordenId) return jsonResponse(NOT_FOUND, 404);

    const { data: orden, error: errOrden } = await supabase
      .from('ordenes')
      .select('id, nombre, estado, cantidad_stickers, monto_total, created_at, vehicle_id, packs_config(nombre)')
      .eq('id', ordenId)
      .single();
    if (errOrden || !orden) return jsonResponse(NOT_FOUND, 404);

    const { data: folios } = await supabase
      .from('estampillas')
      .select('numero_folio, hash_seguridad, es_bonus')
      .eq('orden_id', ordenId)
      .order('orden_en_pack', { ascending: true });

    let vehicleName = '';
    let vehicleImages: string[] = [];
    if (orden.vehicle_id) {
      const { data: vehicle } = await supabase
        .from('vehicles')
        .select('name, vehicle_images(image_url, order_index)')
        .eq('id', orden.vehicle_id)
        .maybeSingle();
      if (vehicle) {
        vehicleName = vehicle.name || '';
        vehicleImages = (vehicle.vehicle_images || [])
          .slice()
          .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
          .map((i: any) => i.image_url);
      }
    }

    return jsonResponse({
      ok: true,
      estado: orden.estado,
      nombre: orden.nombre,
      pack: (orden as any).packs_config?.nombre || '',
      cantidad_stickers: orden.cantidad_stickers,
      monto_total: orden.monto_total,
      fecha: orden.created_at,
      folios: folios || [],
      vehicleName,
      vehicleImages,
    }, 200);
  } catch (e) {
    console.error('lookup-order error:', e);
    return jsonResponse(NOT_FOUND, 404);
  }
});
