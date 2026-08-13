/**
 * test-simulate-purchase — IAC Arica 2026
 *
 * SOLO PARA LA VENTANA DE PRUEBAS antes del lanzamiento (venta real
 * arranca 2026-08-17). Deja que testers invitados vivan el checkout
 * público de punta a punta exactamente como será con Flow real
 * (pantalla de éxito instantánea, folios reales, correo real), pero
 * SIN pasar por Flow — usa confirmar_orden_simulado() server-side.
 *
 * A diferencia de cómo funcionaba esto ANTES de la auditoría de
 * seguridad (RPC abierto a "anon", cualquiera lo podía llamar), acá
 * el candado es un secreto (TEST_MODE_SECRET) que solo conocen quienes
 * reciben el link de prueba — nunca queda expuesto en el código del
 * navegador ni en el RPC de Postgres, que sigue sin permiso para anon.
 *
 * Para CERRAR la ventana de pruebas: borrar/rotar el secret
 * TEST_MODE_SECRET (`supabase secrets unset TEST_MODE_SECRET`). Sin
 * ese secret configurado, esta función rechaza todo por diseño.
 *
 * Secrets necesarios: TEST_MODE_SECRET (el propio secreto de prueba),
 * más los mismos de siempre para el correo (vía send-stamp-email /
 * send-referral-email, ya blindadas a service_role).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  const TEST_MODE_SECRET = Deno.env.get('TEST_MODE_SECRET');
  if (!TEST_MODE_SECRET) return json({ ok: false, error: 'modo_prueba_desactivado' }, 403);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400);
  }
  const { ordenId, secret } = body;
  if (secret !== TEST_MODE_SECRET) return json({ ok: false, error: 'modo_prueba_desactivado' }, 403);
  if (!ordenId) return json({ ok: false, error: 'falta_ordenId' }, 400);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: folios, error } = await supabase.rpc('confirmar_orden_simulado', { p_orden_id: ordenId });
  if (error) {
    if (String(error.message).includes('orden_ya_procesada')) {
      return json({ ok: true, confirmed: true, alreadyProcessed: true, message: 'La orden ya estaba confirmada.' }, 200);
    }
    console.error('confirmar_orden_simulado error:', error);
    return json({ ok: false, error: error.message }, 500);
  }

  let codigoReferido: string | null = null;

  try {
    const { data: orden } = await supabase
      .from('ordenes')
      .select('*, packs_config(nombre)')
      .eq('id', ordenId)
      .single();
    codigoReferido = orden?.codigo_referido || null;

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
        const { data: bonos } = await supabase.rpc('bonos_pendientes_notificacion', { p_orden_id: ordenId });
        const bonusEstampillas = (bonos || []).map((b: any) => ({
          folio: b.numero_folio,
          hash: b.hash_seguridad,
          imagenUrl: pickImgForFolio(b.numero_folio),
        }));

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
            bonusEstampillas,
            vehicleName: sorteo?.vehicles?.name || 'Vehículo',
            vehicleImg,
            fechaSorteo: fechaStr,
          }),
        }).catch((e) => console.warn('send-referral-email falló:', e));
      }
    }
  } catch (e) {
    console.error('Error armando/enviando correos post-simulación:', e);
  }

  return json({
    ok: true,
    confirmed: true,
    folios: (folios || []).map((f: any) => ({ numero_folio: f.numero_folio, hash_seguridad: f.hash_seguridad, es_bonus: false })),
    codigo_referido: codigoReferido,
  }, 200);
});
