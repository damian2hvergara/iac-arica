/**
 * send-referral-email — IAC Arica 2026
 * Avisa al REFERENTE cuando alguien compra usando su código: cuántas
 * lleva acumuladas, cuántas estampillas bonus ya ganó y cuántas le
 * faltan para la próxima — para entusiasmarlo a seguir compartiendo.
 *
 * Si el llamador manda bonusEstampillas (una o más estampillas de
 * regalo recién generadas, con su folio real), el correo destaca eso
 * primero con la misma tarjeta visual que send-stamp-email — antes
 * solo se avisaba "vas sumando", nunca se mandaba la estampilla en sí.
 *
 * Secrets necesarios: RESEND_API_KEY, RESEND_FROM (los mismos que
 * usa send-stamp-email).
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
  }

  const {
    referenteEmail, referenteNombre, referidoNombre, cantidadComprada,
    totalAcumulado, bonosGanados, faltanParaProximo, codigoReferido,
    bonusEstampillas, vehicleName, vehicleImg, fechaSorteo,
  } = body;

  if (!referenteEmail || !referenteNombre) {
    return new Response('Faltan datos', { status: 400, headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
  const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'noreply@iac-arica.cl';

  const shareUrl = `https://iac-arica.cl/stamper.html?ref=${encodeURIComponent(codigoReferido || '')}`;
  const wspMsg = encodeURIComponent(
    `🏆 ¡Estoy participando en el sorteo de IAC Arica! Consigue tu sticker → ${shareUrl}`
  );

  const bonoLinea = bonosGanados > 0
    ? `Ya ganaste <strong style="color:#F0D080;">${bonosGanados} estampilla${bonosGanados > 1 ? 's' : ''} gratis</strong> por invitar amigos.`
    : `Aún no ganas ninguna estampilla gratis — ¡vas en camino a la primera!`;

  const tieneBono = Array.isArray(bonusEstampillas) && bonusEstampillas.length > 0;

  const bonusCards = tieneBono ? bonusEstampillas.map((e: any) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(140deg,#0a1f10,#0d0d0d);border-radius:12px;border:1px solid rgba(0,197,102,0.45);margin-bottom:14px;">
      <tr><td style="padding:10px 16px;border-bottom:1px solid #2a2a2a;">
        <span style="color:#F0D080;font-family:monospace;font-size:14px;font-weight:700;letter-spacing:1px;">${e.folio}</span>
        <span style="color:#00C566;font-size:11px;float:right;line-height:1.8;">🎁 Estampilla de regalo</span>
      </td></tr>
      ${(e.imagenUrl || vehicleImg) ? `<tr><td><img src="${e.imagenUrl || vehicleImg}" width="100%" style="display:block;height:150px;object-fit:cover;"></td></tr>` : ''}
      <tr><td style="padding:14px 16px;">
        <p style="font-family:monospace;font-size:10px;color:rgba(201,168,76,0.65);letter-spacing:2px;margin:0 0 8px;">CHILE · ARICA</p>
        <p style="font-family:'Arial Black',sans-serif;font-size:18px;font-weight:900;color:#fff;text-align:center;margin:0 0 3px;text-transform:uppercase;">${vehicleName || 'Vehículo'}</p>
        <p style="font-family:monospace;font-size:9px;color:rgba(240,208,128,0.6);text-align:center;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 12px;">COLECCIÓN CHILE NORTE · EDICIÓN LIMITADA</p>
        <hr style="border:none;border-top:1px solid rgba(201,168,76,0.2);margin:0 0 12px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td><p style="font-family:monospace;font-size:9px;color:rgba(255,255,255,0.35);text-transform:uppercase;margin:0 0 2px;">SORTEO</p>
            <p style="font-size:11px;color:rgba(255,255,255,0.75);font-weight:600;margin:0;">${fechaSorteo || 'Por confirmar'}</p></td>
          <td align="right"><p style="font-family:monospace;font-size:9px;color:rgba(240,208,128,0.45);text-transform:uppercase;margin:0 0 2px;">FOLIO</p>
            <p style="font-family:monospace;font-size:13px;color:#F0D080;font-weight:700;margin:0;">${e.folio}</p></td>
        </tr></table>
        <p style="font-family:monospace;font-size:9px;color:rgba(255,255,255,0.22);text-align:center;margin:10px 0 0;">Hash: ${e.hash}</p>
      </td></tr>
    </table>`).join('') : '';

  const heroIconBg = tieneBono ? 'rgba(233,200,118,0.16)' : 'rgba(0,197,102,0.15)';
  const heroIconBorder = tieneBono ? 'rgba(233,200,118,0.45)' : 'rgba(0,197,102,0.4)';
  const heroIcon = tieneBono ? '🎁' : '🎉';
  const heroTitle = tieneBono
    ? `¡Ganaste ${bonusEstampillas.length > 1 ? bonusEstampillas.length + ' estampillas' : 'una estampilla'} gratis!`
    : '¡Tu código sigue sumando!';
  const heroSub = tieneBono
    ? `Hola <strong style="color:#F2F2F2;">${referenteNombre}</strong>, ya sumaste ${cantidadComprada ? `<strong style="color:#F0D080;">${cantidadComprada} estampilla${cantidadComprada > 1 ? 's' : ''}</strong> referidas de tu amigo <strong style="color:#F0D080;">${referidoNombre || ''}</strong>, y` : ''} completaste otro grupo de 4 — aquí está tu estampilla de regalo, con su propio folio y número de participación en el sorteo.`
    : `Hola <strong style="color:#F2F2F2;">${referenteNombre}</strong>, tu amigo
      <strong style="color:#F0D080;">${referidoNombre || 'un referido'}</strong> acaba de comprar
      <strong style="color:#F0D080;">${cantidadComprada} estampilla${cantidadComprada > 1 ? 's' : ''}</strong> usando tu código.`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0C0C0C;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0C0C;padding:32px 0;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <tr><td style="background:linear-gradient(135deg,#161616,#1a0a02);border:1px solid #2a2a2a;border-radius:16px 16px 0 0;padding:32px 28px 24px;text-align:center;">
    <p style="font-family:'Arial Black',sans-serif;font-size:22px;font-weight:900;color:#fff;margin:0 0 6px;"><span style="color:#9B0000;">Import</span> American Cars</p>
    <p style="font-family:monospace;font-size:10px;color:rgba(201,168,76,0.7);letter-spacing:2px;text-transform:uppercase;margin:0 0 24px;">ARICA · CHILE</p>
    <div style="width:64px;height:64px;border-radius:50%;background:${heroIconBg};border:2px solid ${heroIconBorder};margin:0 auto 16px;text-align:center;line-height:62px;font-size:28px;">${heroIcon}</div>
    <h1 style="font-family:'Arial Black',sans-serif;font-size:24px;font-weight:900;color:#fff;margin:0 0 8px;">${heroTitle}</h1>
    <p style="font-size:14px;color:#6E6E6E;margin:0;line-height:1.6;">${heroSub}</p>
  </td></tr>

  ${tieneBono ? `
  <tr><td style="background:#161616;border-left:1px solid #2a2a2a;border-right:1px solid #2a2a2a;padding:24px 20px 4px;">
    <p style="font-family:'Arial Black',sans-serif;font-size:14px;font-weight:900;color:#fff;margin:0 0 16px;text-transform:uppercase;">🎁 Tu${bonusEstampillas.length > 1 ? 's' : ''} estampilla${bonusEstampillas.length > 1 ? 's' : ''} de regalo</p>
    ${bonusCards}
  </td></tr>` : ''}

  <tr><td style="background:#161616;border-left:1px solid #2a2a2a;border-right:1px solid #2a2a2a;padding:24px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#202020;border:1px solid #2a2a2a;border-radius:10px;padding:18px 16px;">
      <tr><td>
        <p style="font-size:13px;color:#F2F2F2;margin:0 0 10px;">Llevas <strong style="color:#F0D080;">${totalAcumulado}</strong> estampilla${totalAcumulado === 1 ? '' : 's'} referidas en total.</p>
        <p style="font-size:13px;color:#F2F2F2;margin:0 0 10px;">${bonoLinea}</p>
        <p style="font-size:13px;color:#00C566;font-weight:700;margin:0;">Te faltan ${faltanParaProximo} estampilla${faltanParaProximo === 1 ? '' : 's'} más para tu próxima estampilla gratis.</p>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="background:#161616;border-left:1px solid #2a2a2a;border-right:1px solid #2a2a2a;padding:0 20px 24px;text-align:center;">
    <p style="font-size:13px;color:#6E6E6E;margin:16px 0 14px;">Sigue compartiendo tu link y suma más gratis 👇</p>
    <a href="https://wa.me/?text=${wspMsg}" style="display:inline-block;background:#25D366;color:#000;font-family:'Arial Black',sans-serif;font-size:15px;font-weight:900;padding:14px 28px;border-radius:999px;text-decoration:none;">💬 Compartir de nuevo</a>
  </td></tr>

  <tr><td style="background:#161616;border:1px solid #2a2a2a;border-radius:0 0 16px 16px;padding:20px 28px;text-align:center;">
    <p style="font-family:'Arial Black',sans-serif;font-size:16px;font-weight:900;color:#fff;margin:0 0 6px;"><span style="color:#9B0000;">Import</span> American Cars</p>
    <p style="font-size:11px;color:#3E3E3E;margin:0;line-height:1.8;">
      Arica, Chile · <a href="https://iac-arica.cl" style="color:#6E6E6E;text-decoration:none;">iac-arica.cl</a>
    </p>
  </td></tr>

</table></td></tr></table>
</body></html>`;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Import American Cars <${RESEND_FROM}>`,
        to: [referenteEmail],
        subject: tieneBono
          ? `🎁 ¡Ganaste ${bonusEstampillas.length > 1 ? bonusEstampillas.length + ' estampillas' : 'una estampilla'} gratis por tus referidos!`
          : `🎉 ${referidoNombre || 'Tu referido'} compró con tu código — te faltan ${faltanParaProximo} para tu bono`,
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return new Response(JSON.stringify({ error: err }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await resendRes.json();
    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    console.error('Error:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
