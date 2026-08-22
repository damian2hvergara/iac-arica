/**
 * admin-simulate-purchase — IAC Arica 2026
 *
 * SOLO PARA PRUEBAS. Confirma una orden pendiente SIN pasar por
 * Mercado Pago — útil mientras MP_ACCESS_TOKEN no esté configurada y
 * no se pueda probar el sistema completo de otra forma. Hace
 * exactamente lo mismo que mp-webhook hace tras un pago real (genera
 * folios, aplica bono de referido, manda los correos), pero en vez de
 * verificar con Mercado Pago, usa confirmar_orden_simulado().
 *
 * Por eso mismo NUNCA debe quedar accesible para el público: exige
 * una sesión real de Supabase Auth cuyo email esté en admin_emails
 * (mismo criterio que send-referral-nudge, ver parte 27/29). No
 * reemplaza a mp-webhook para pagos reales — confirmar_orden() sigue
 * sin permiso para nadie salvo service_role.
 *
 * Candado de ambiente (2026-08-22): igual que test-simulate-purchase,
 * exige TEST_MODE_SECRET configurado. El botón "🧪 Simular pago" del
 * panel admin aparece para CUALQUIER orden sin mp_payment_id — con
 * Mercado Pago ya en producción, eso incluye carritos abandonados de
 * compradores reales, así que confirmar "a mano" generaría folios y
 * correos reales sin que haya entrado plata. Sin el secret, esta
 * función queda cerrada por defecto; si alguna vez hace falta
 * reabrirla para pruebas controladas, basta con volver a setear
 * TEST_MODE_SECRET.
 *
 * Secrets necesarios: TEST_MODE_SECRET (candado), más los mismos que
 * send-stamp-email/send-referral-email.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logEvent, logRepeatedAttempt } from '../_shared/log-event.ts';

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

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  if (!Deno.env.get('TEST_MODE_SECRET')) {
    return json({ ok: false, error: 'simulacion_desactivada' }, 403);
  }

  // --- Solo admin ---
  const authHeader = req.headers.get('Authorization') || '';
  const callerToken = authHeader.replace(/^Bearer\s+/i, '');
  const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: userData, error: userErr } = await anonClient.auth.getUser(callerToken);
  const callerEmail = userData?.user?.email?.toLowerCase();
  if (userErr || !callerEmail) {
    await logRepeatedAttempt(supabase, {
      source: 'admin-simulate-purchase',
      message: 'Llamada sin sesión válida a admin-simulate-purchase.',
    });
    return json({ ok: false, error: 'no_autorizado' }, 401);
  }

  const { data: adminRow, error: adminErr } = await supabase.from('admin_emails').select('email').eq('email', callerEmail).maybeSingle();
  if (adminErr) {
    console.error('admin-simulate-purchase: error consultando admin_emails:', adminErr);
    await logEvent(supabase, {
      category: 'error', severity: 'critical', source: 'admin-simulate-purchase',
      message: 'La consulta a admin_emails falló (no es que el email no esté en la lista) — revisar SUPABASE_SERVICE_ROLE_KEY.',
      detail: { email: callerEmail, error: adminErr.message, code: adminErr.code },
    });
    return json({ ok: false, error: 'error_verificando_admin' }, 500);
  }
  if (!adminRow) {
    await logEvent(supabase, {
      category: 'security', severity: 'high', source: 'admin-simulate-purchase',
      message: 'Sesión válida pero fuera de admin_emails intentó usar admin-simulate-purchase.',
      detail: { email: callerEmail },
    });
    return json({ ok: false, error: 'no_autorizado' }, 403);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'invalid_body' }, 400);
  }
  const ordenId = body?.ordenId;
  if (!ordenId) return json({ ok: false, error: 'falta_ordenId' }, 400);

  const { data: folios, error } = await supabase.rpc('confirmar_orden_simulado', { p_orden_id: ordenId });
  if (error) {
    if (String(error.message).includes('orden_ya_procesada')) {
      return json({ ok: true, confirmed: true, alreadyProcessed: true, message: 'La orden ya estaba confirmada.' }, 200);
    }
    console.error('confirmar_orden_simulado error:', error);
    return json({ ok: false, error: error.message }, 500);
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

  return json({ ok: true, confirmed: true, folios, message: '[PRUEBA] Orden confirmada sin Mercado Pago — folios generados y correo enviado.' }, 200);
});
