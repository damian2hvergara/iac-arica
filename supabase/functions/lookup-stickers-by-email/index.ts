/**
 * lookup-stickers-by-email — IAC Arica 2026
 * Devuelve TODAS las órdenes (con sus estampillas) asociadas a un
 * correo, para mi-cuenta.html. A propósito solo pide el correo —
 * simplifica la consulta frente al flujo anterior que exigía además
 * la referencia de orden o el folio.
 *
 * Esto no compromete el sorteo: el folio por sí solo no sirve para
 * reclamar el premio, hace falta además el comprobante de pago y que
 * la identidad coincida con el nombre registrado en la compra
 * (cláusula Tercera de las bases) — así que mostrarlo con solo el
 * correo es una simplificación de UX, no un hueco de seguridad sobre
 * el premio en sí.
 *
 * Usa la service role key (nunca expuesta al browser) para saltarse
 * RLS y hacer el match server-side.
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
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonResponse({ ok: false, error: 'Ingresa un correo válido.' }, 400);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const { data: ordenes, error: errOrdenes } = await supabase
      .from('ordenes')
      .select('id, nombre, estado, tipo, cantidad_stickers, monto_total, created_at, vehicle_id, packs_config(nombre)')
      .eq('email', email)
      .order('created_at', { ascending: false });

    if (errOrdenes) throw errOrdenes;
    if (!ordenes || !ordenes.length) {
      return jsonResponse({ ok: false, error: 'No encontramos compras con ese correo.' }, 404);
    }

    const ordenIds = ordenes.map((o: any) => o.id);
    const { data: folios } = await supabase
      .from('estampillas')
      .select('orden_id, numero_folio, hash_seguridad, es_bonus, orden_en_pack')
      .in('orden_id', ordenIds)
      .order('orden_en_pack', { ascending: true });

    const foliosPorOrden: Record<string, any[]> = {};
    (folios || []).forEach((f: any) => {
      (foliosPorOrden[f.orden_id] ||= []).push(f);
    });

    const vehicleIds = [...new Set(ordenes.map((o: any) => o.vehicle_id).filter(Boolean))];
    const vehiclesById: Record<string, { name: string; images: string[] }> = {};
    if (vehicleIds.length) {
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select('id, name, vehicle_images(image_url, order_index)')
        .in('id', vehicleIds as string[]);
      (vehicles || []).forEach((v: any) => {
        vehiclesById[v.id] = {
          name: v.name || '',
          images: (v.vehicle_images || [])
            .slice()
            .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
            .map((i: any) => i.image_url),
        };
      });
    }

    const resultado = ordenes.map((o: any) => ({
      ordenId: o.id,
      nombre: o.nombre,
      estado: o.estado,
      tipo: o.tipo || 'comprado',
      pack: o.packs_config?.nombre || '',
      cantidad_stickers: o.cantidad_stickers,
      monto_total: o.monto_total,
      fecha: o.created_at,
      vehicleName: o.vehicle_id ? vehiclesById[o.vehicle_id]?.name || '' : '',
      vehicleImages: o.vehicle_id ? vehiclesById[o.vehicle_id]?.images || [] : [],
      folios: foliosPorOrden[o.id] || [],
    }));

    return jsonResponse({ ok: true, ordenes: resultado }, 200);
  } catch (e) {
    console.error('lookup-stickers-by-email error:', e);
    return jsonResponse({ ok: false, error: 'No pudimos hacer la búsqueda. Intenta de nuevo.' }, 500);
  }
});
