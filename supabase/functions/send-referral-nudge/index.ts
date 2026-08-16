/**
 * send-referral-nudge — IAC Arica 2026
 * Recordatorio para compradores que AÚN no han referido a nadie:
 * "no olvides compartir tu link". Lo dispara el admin manualmente
 * desde stamper-admin.html (campaña puntual, no un cron automático).
 *
 * Antes cualquiera con la anon key podía llamarla directo y mandar
 * este correo a cualquier destinatario con nombre/código inventados.
 * Ahora exige el JWT de una sesión real de Supabase Auth cuyo email
 * esté en admin_emails — el mismo criterio que usa la RLS del resto
 * del panel admin (ver migración parte 27).
 *
 * Secrets necesarios: RESEND_API_KEY, RESEND_FROM (los mismos que
 * las otras funciones de correo).
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
      source: 'send-referral-nudge',
      message: 'Llamada sin sesión válida a send-referral-nudge.',
    });
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const { data: adminRow } = await adminClient.from('admin_emails').select('email').eq('email', callerEmail).maybeSingle();
  if (!adminRow) {
    await logEvent(adminClient, {
      category: 'security', severity: 'high', source: 'send-referral-nudge',
      message: 'Sesión válida pero fuera de admin_emails intentó usar send-referral-nudge.',
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

  const { email, codigoReferido } = body;
  const nombre = escapeHtml(body.nombre);
  if (!body.nombre || !email || !codigoReferido) {
    return new Response('Faltan datos', { status: 400, headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
  const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'noreply@iac-arica.cl';

  const shareUrl = `https://iac-arica.cl/stamper.html?ref=${encodeURIComponent(codigoReferido)}`;
  const wspMsg = encodeURIComponent(
    `🏆 ¡Estoy participando en el sorteo de IAC Arica! Consigue tu sticker → ${shareUrl}`
  );

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0C0C0C;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0C0C;padding:32px 0;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <tr><td style="background:linear-gradient(135deg,#161616,#1a0a02);border:1px solid #2a2a2a;border-radius:16px 16px 0 0;padding:32px 28px 24px;text-align:center;">
    <p style="font-family:'Arial Black',sans-serif;font-size:22px;font-weight:900;color:#fff;margin:0 0 6px;"><span style="color:#9B0000;">Import</span> American Cars</p>
    <p style="font-family:monospace;font-size:10px;color:rgba(201,168,76,0.7);letter-spacing:2px;text-transform:uppercase;margin:0 0 24px;">ARICA · CHILE</p>
    <div style="width:64px;height:64px;border-radius:50%;background:rgba(240,208,128,0.15);border:2px solid rgba(240,208,128,0.4);margin:0 auto 16px;text-align:center;line-height:62px;font-size:28px;">🎁</div>
    <h1 style="font-family:'Arial Black',sans-serif;font-size:22px;font-weight:900;color:#fff;margin:0 0 8px;">Te falta activar tu regalo</h1>
    <p style="font-size:14px;color:#6E6E6E;margin:0;line-height:1.6;">
      Hola <strong style="color:#F2F2F2;">${nombre}</strong>, todavía no has compartido tu link de
      referidos — y cada 4 estampillas que compren tus amigos con él, te ganas 1 gratis.
      Compártelo y activa tu primera estampilla de regalo.
    </p>
  </td></tr>

  <tr><td style="background:#161616;border-left:1px solid #2a2a2a;border-right:1px solid #2a2a2a;padding:24px 20px;text-align:center;">
    <p style="font-size:11px;color:#6E6E6E;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Tu link personal de referidos</p>
    <a href="${shareUrl}" style="display:inline-block;background:#202020;border:1px solid #2a2a2a;border-radius:8px;padding:12px 16px;font-family:monospace;font-size:12px;color:#F0D080;text-decoration:none;word-break:break-all;">${shareUrl}</a>
    <p style="font-size:13px;color:#6E6E6E;margin:20px 0 14px;">Compártelo ahora 👇</p>
    <a href="https://wa.me/?text=${wspMsg}" style="display:inline-block;background:#25D366;color:#000;font-family:'Arial Black',sans-serif;font-size:15px;font-weight:900;padding:14px 28px;border-radius:999px;text-decoration:none;">💬 Compartir en WhatsApp</a>
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
        to: [email],
        subject: '🎁 Aún puedes ganar una estampilla gratis — comparte tu link',
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
