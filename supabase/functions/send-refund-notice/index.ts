/**
 * send-refund-notice — IAC Arica 2026
 *
 * Avisa a un comprador que el sorteo no se realizará (Anexo
 * Modificatorio N° 1, 09-oct-2026) y que se le devolverá el 100% de
 * lo pagado. Lo dispara el admin manualmente desde devoluciones.html
 * — un solo correo por persona (agrupa todas sus órdenes), nunca un
 * cron automático.
 *
 * Mismo criterio de autorización que send-launch-announcement/
 * send-referral-nudge (parte 27): exige JWT de una sesión real de
 * Supabase Auth cuyo email esté en admin_emails.
 *
 * A propósito con estética sobria, sin festividad — carta formal, no
 * campaña de marketing. Sin números de serie ni de edición, sin
 * cifras de venta agregadas (solo el monto de ESE comprador, que es
 * su propia información).
 *
 * Secrets necesarios: RESEND_API_KEY, RESEND_FROM.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { logEvent, logRepeatedAttempt } from '../_shared/log-event.ts';

function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const adminClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const authHeader = req.headers.get('Authorization') || '';
  const callerToken = authHeader.replace(/^Bearer\s+/i, '');
  const anonClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: userData, error: userErr } = await anonClient.auth.getUser(callerToken);
  const callerEmail = userData?.user?.email?.toLowerCase();
  if (userErr || !callerEmail) {
    await logRepeatedAttempt(adminClient, {
      source: 'send-refund-notice',
      message: 'Llamada sin sesión válida a send-refund-notice.',
    });
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { data: adminRow, error: adminErr } = await adminClient.from('admin_emails').select('email').eq('email', callerEmail).maybeSingle();
  if (adminErr) {
    console.error('send-refund-notice: error consultando admin_emails:', adminErr);
    return new Response(JSON.stringify({ error: 'error_verificando_admin' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!adminRow) {
    await logEvent(adminClient, {
      category: 'security', severity: 'high', source: 'send-refund-notice',
      message: 'Sesión válida pero fuera de admin_emails intentó usar send-refund-notice.',
      detail: { email: callerEmail },
    });
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
  }

  const { email, cantidad, montoTotal } = body;
  const nombre = escapeHtml(body.nombre);
  if (!body.nombre || !email || !cantidad || montoTotal === undefined || montoTotal === null) {
    return new Response('Faltan datos', { status: 400, headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
  const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'noreply@iac-arica.cl';
  const montoStr = Number(montoTotal).toLocaleString('es-CL');
  const linkAnexo = 'https://iac-arica.cl/anexo-modificatorio-1-sorteo-iac-2026.pdf';
  const linkBases = 'https://iac-arica.cl/bases-legales-sorteo-2026.pdf';

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#ffffff;border:1px solid #ddd;">

  <tr><td style="padding:28px 32px 20px;border-bottom:2px solid #9B0000;">
    <p style="font-family:Arial,sans-serif;font-size:17px;font-weight:700;color:#222;margin:0;">Import American Cars</p>
    <p style="font-size:11px;color:#777;letter-spacing:1px;text-transform:uppercase;margin:4px 0 0;">Sorteo IAC Arica 2026</p>
  </td></tr>

  <tr><td style="padding:28px 32px;">
    <p style="font-size:14px;color:#222;line-height:1.7;margin:0 0 16px;">Hola ${nombre}:</p>

    <p style="font-size:14px;color:#222;line-height:1.7;margin:0 0 16px;">
      Te escribimos para informarte que el sorteo del Dodge Challenger 2018 no se realizará.
      No se cumplieron las condiciones establecidas en las bases para llevarlo a cabo, y
      preferimos ser transparentes antes que extender la fecha de forma indefinida.
    </p>

    <p style="font-size:14px;color:#222;line-height:1.7;margin:0 0 10px;">
      Por eso vamos a devolverte el 100% de lo que pagaste, sin descuentos:
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;border:1px solid #e0e0e0;margin:0 0 18px;">
      <tr><td style="padding:10px 16px;font-size:13.5px;color:#555;border-bottom:1px solid #e0e0e0;">Tus Stickers Digitales</td>
          <td style="padding:10px 16px;font-size:13.5px;color:#222;text-align:right;border-bottom:1px solid #e0e0e0;font-weight:700;">${cantidad}</td></tr>
      <tr><td style="padding:10px 16px;font-size:13.5px;color:#555;">Monto a devolver</td>
          <td style="padding:10px 16px;font-size:15px;color:#222;text-align:right;font-weight:700;">$${montoStr}</td></tr>
    </table>

    <p style="font-size:14px;color:#222;line-height:1.7;margin:0 0 16px;">
      La devolución se hará a través de Mercado Pago, al mismo medio de pago que usaste, en un
      plazo máximo de 30 días. Si pagaste con tarjeta, el tiempo en que se refleje dependerá
      de tu banco o emisor. No necesitas hacer ningún trámite.
    </p>

    <p style="font-size:14px;color:#222;line-height:1.7;margin:0 0 16px;">
      Tu Sticker Digital y su certificado de autenticidad siguen siendo tuyos: puedes
      conservarlos.
    </p>

    <p style="font-size:14px;color:#222;line-height:1.7;margin:0 0 20px;">
      Puedes revisar el Anexo Modificatorio N° 1 y las bases del sorteo aquí:<br>
      <a href="${linkAnexo}" style="color:#9B0000;">Anexo Modificatorio N° 1</a> ·
      <a href="${linkBases}" style="color:#9B0000;">Bases del sorteo</a>
    </p>

    <p style="font-size:14px;color:#222;line-height:1.7;margin:0 0 20px;">
      Ante cualquier consulta, escríbenos a
      <a href="mailto:contacto@importamericancars.cl" style="color:#9B0000;">contacto@importamericancars.cl</a>
      o por WhatsApp al <a href="https://wa.me/56953526956" style="color:#9B0000;">+56 9 5352 6956</a>.
    </p>

    <p style="font-size:14px;color:#222;line-height:1.7;margin:0;">
      Gracias por tu confianza.<br>Equipo IAC Arica
    </p>
  </td></tr>

  <tr><td style="padding:16px 32px;border-top:1px solid #e0e0e0;">
    <p style="font-size:11px;color:#999;margin:0;line-height:1.6;">
      CV North Capital SpA — Import American Cars / IAC Arica · Arica, Chile ·
      <a href="https://iac-arica.cl" style="color:#999;">iac-arica.cl</a>
    </p>
  </td></tr>

</table></td></tr></table>
</body></html>`;

  const text = `Hola ${nombre}:

Te escribimos para informarte que el sorteo del Dodge Challenger 2018 no se realizará. No se cumplieron las condiciones establecidas en las bases para llevarlo a cabo, y preferimos ser transparentes antes que extender la fecha de forma indefinida.

Por eso vamos a devolverte el 100% de lo que pagaste, sin descuentos:
- Tus Stickers Digitales: ${cantidad}
- Monto a devolver: $${montoStr}

La devolución se hará a través de Mercado Pago, al mismo medio de pago que usaste, en un plazo máximo de 30 días. Si pagaste con tarjeta, el tiempo en que se refleje dependerá de tu banco o emisor. No necesitas hacer ningún trámite.

Tu Sticker Digital y su certificado de autenticidad siguen siendo tuyos: puedes conservarlos.

Anexo Modificatorio N° 1: ${linkAnexo}
Bases del sorteo: ${linkBases}

Ante cualquier consulta, escríbenos a contacto@importamericancars.cl o por WhatsApp al +56 9 5352 6956.

Gracias por tu confianza.
Equipo IAC Arica`;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `Import American Cars <${RESEND_FROM}>`,
        to: [email],
        subject: 'Sorteo IAC Arica 2026 — Devolución íntegra de tu compra',
        html,
        text,
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
