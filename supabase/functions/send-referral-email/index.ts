/**
 * send-referral-email — IAC Arica 2026
 * Avisa al REFERENTE cuando alguien compra usando su código: cuántas
 * lleva acumuladas, cuántas estampillas bonus ya ganó y cuántas le
 * faltan para la próxima — para entusiasmarlo a seguir compartiendo.
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

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0C0C0C;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0C0C;padding:32px 0;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <tr><td style="background:linear-gradient(135deg,#161616,#1a0a02);border:1px solid #2a2a2a;border-radius:16px 16px 0 0;padding:32px 28px 24px;text-align:center;">
    <p style="font-family:'Arial Black',sans-serif;font-size:22px;font-weight:900;color:#fff;margin:0 0 6px;"><span style="color:#9B0000;">Import</span> American Cars</p>
    <p style="font-family:monospace;font-size:10px;color:rgba(201,168,76,0.7);letter-spacing:2px;text-transform:uppercase;margin:0 0 24px;">ARICA · CHILE</p>
    <div style="width:64px;height:64px;border-radius:50%;background:rgba(0,197,102,0.15);border:2px solid rgba(0,197,102,0.4);margin:0 auto 16px;text-align:center;line-height:62px;font-size:28px;">🎉</div>
    <h1 style="font-family:'Arial Black',sans-serif;font-size:24px;font-weight:900;color:#fff;margin:0 0 8px;">¡Tu código sigue sumando!</h1>
    <p style="font-size:14px;color:#6E6E6E;margin:0;line-height:1.6;">
      Hola <strong style="color:#F2F2F2;">${referenteNombre}</strong>, tu amigo
      <strong style="color:#F0D080;">${referidoNombre || 'un referido'}</strong> acaba de comprar
      <strong style="color:#F0D080;">${cantidadComprada} estampilla${cantidadComprada > 1 ? 's' : ''}</strong> usando tu código.
    </p>
  </td></tr>

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
        subject: `🎉 ${referidoNombre || 'Tu referido'} compró con tu código — te faltan ${faltanParaProximo} para tu bono`,
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
