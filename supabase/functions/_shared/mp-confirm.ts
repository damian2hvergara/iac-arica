/**
 * _shared/mp-confirm.ts — IAC Arica 2026
 *
 * Lógica de confirmación de pago compartida entre mp-process-payment
 * (submit síncrono del Payment Brick) y mp-webhook (notificaciones
 * asíncronas de Mercado Pago) — ambos necesitan exactamente la misma
 * secuencia (confirmar_orden + correo de estampillas + aviso al
 * referente si corresponde), y mantenerla duplicada en dos archivos
 * es exactamente el tipo de drift que ya causó bugs reales en este
 * proyecto (ver confirmar_orden vs confirmar_orden_simulado). Segundo
 * módulo compartido del repo — mismo criterio que log-event.ts.
 */
import { logEvent } from './log-event.ts';

interface ConfirmarPagoOpts {
  ordenId: string;
  mpPaymentId: string;
  mpPaymentType: string | null;
  source: string; // 'mp-process-payment' | 'mp-webhook' — para los logs
}

export async function confirmarPagoAprobado(
  supabase: any,
  opts: ConfirmarPagoOpts
): Promise<{ ok: boolean; folios?: any[]; alreadyProcessed?: boolean; error?: string }> {
  const { ordenId, mpPaymentId, mpPaymentType, source } = opts;

  const { data: folios, error } = await supabase.rpc('confirmar_orden', { p_orden_id: ordenId });
  if (error) {
    if (String(error.message).includes('orden_ya_procesada')) {
      return { ok: true, alreadyProcessed: true };
    }
    console.error(`${source}: confirmar_orden error:`, error);
    await logEvent(supabase, {
      category: 'payment', severity: 'critical', source,
      message: 'Mercado Pago confirmó un pago pero confirmar_orden() falló — el pago quedó cobrado sin registrar en el sistema.',
      detail: { error: error.message, mpPaymentId }, orderId: ordenId,
    });
    return { ok: false, error: 'error_confirmando_orden' };
  }

  await supabase.from('ordenes').update({
    mp_payment_id: mpPaymentId, mp_payment_status: 'approved', mp_payment_type: mpPaymentType,
  }).eq('id', ordenId);

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
    }).then(async (res) => {
      if (!res.ok) {
        console.warn('send-stamp-email respondió', res.status);
        await logEvent(supabase, {
          category: 'error', severity: 'high', source,
          message: 'El comprador pagó pero el correo con sus estampillas no se pudo enviar.',
          detail: { status: res.status, email: orden.email }, orderId: ordenId,
        });
      }
    }).catch(async (e) => {
      console.warn('send-stamp-email falló:', e);
      await logEvent(supabase, {
        category: 'error', severity: 'high', source,
        message: 'El comprador pagó pero el correo con sus estampillas no se pudo enviar.',
        detail: { error: String(e?.message || e), email: orden.email }, orderId: ordenId,
      });
    });

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
        }).then(async (res) => {
          if (!res.ok) {
            console.warn('send-referral-email respondió', res.status);
            await logEvent(supabase, {
              category: 'error', severity: 'high', source,
              message: 'No se pudo avisar al referente por correo tras una compra confirmada.',
              detail: { status: res.status, referenteEmail: info.referente_email }, orderId: ordenId,
            });
          }
        }).catch(async (e) => {
          console.warn('send-referral-email falló:', e);
          await logEvent(supabase, {
            category: 'error', severity: 'high', source,
            message: 'No se pudo avisar al referente por correo tras una compra confirmada.',
            detail: { error: String(e?.message || e), referenteEmail: info.referente_email }, orderId: ordenId,
          });
        });
      }
    }
  } catch (e) {
    console.error(`${source}: error armando/enviando correos post-confirmación:`, e);
    await logEvent(supabase, {
      category: 'error', severity: 'high', source,
      message: 'Error inesperado armando o enviando los correos después de confirmar un pago.',
      detail: { error: String((e as any)?.message || e) }, orderId: ordenId,
    });
  }

  return { ok: true, folios };
}

export async function marcarPagoRechazado(
  supabase: any,
  opts: { ordenId: string; mpPaymentId: string; mpPaymentStatus: string; mpPaymentType: string | null }
): Promise<void> {
  await supabase.from('ordenes').update({
    mp_payment_id: opts.mpPaymentId, mp_payment_status: opts.mpPaymentStatus, mp_payment_type: opts.mpPaymentType,
  }).eq('id', opts.ordenId);
  await supabase
    .rpc('rechazar_orden', { p_orden_id: opts.ordenId, p_nota: `Mercado Pago: status=${opts.mpPaymentStatus}` })
    .catch((e: any) => console.warn('rechazar_orden falló (puede que ya estuviera procesada):', e));
}
