/**
 * send-alert-email — IAC Arica 2026
 * Manda al dueño (ALERT_EMAIL_TO) un correo cuando el sistema de
 * monitoreo detecta algo grave: un pago que no se procesó bien, un
 * intento de vulnerar la seguridad, un intento de meter datos
 * maliciosos, o cualquier error que le pegue a un comprador — ver
 * supabase/functions/_shared/log-event.ts, que es quien decide cuándo
 * llamar a esta función (no todo lo que se loggea manda correo).
 *
 * Igual que send-stamp-email: solo acepta llamadas con la service
 * role key exacta — nadie más debe poder mandar correos desde acá.
 *
 * Secrets necesarios: RESEND_API_KEY, RESEND_FROM, ALERT_EMAIL_TO.
 */

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

const SEVERITY_LABEL: Record<string, string> = {
  low: 'Baja', medium: 'Media', high: 'Alta', critical: 'CRÍTICA',
};
const SEVERITY_COLOR: Record<string, string> = {
  low: '#6E6E6E', medium: '#F59E0B', high: '#ff3b30', critical: '#9B0000',
};
const CATEGORY_LABEL: Record<string, string> = {
  error: 'Error', payment: 'Pago', security: 'Seguridad', abuse: 'Abuso', info: 'Info',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (req.headers.get('Authorization') !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
  }

  const { category, severity, source, message, detail, eventId, orderId } = body;
  if (!category || !severity || !source || !message) {
    return new Response('Faltan datos', { status: 400, headers: corsHeaders });
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
  const RESEND_FROM = Deno.env.get('RESEND_FROM') ?? 'noreply@iac-arica.cl';
  const ALERT_EMAIL_TO = Deno.env.get('ALERT_EMAIL_TO');
  if (!ALERT_EMAIL_TO) {
    console.error('ALERT_EMAIL_TO no configurado — no se puede mandar la alerta');
    return new Response(JSON.stringify({ error: 'alert_email_to_no_configurado' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const color = SEVERITY_COLOR[severity] || '#6E6E6E';
  const sevLabel = SEVERITY_LABEL[severity] || severity;
  const catLabel = CATEGORY_LABEL[category] || category;
  const fecha = new Date().toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
  const detailStr = detail ? JSON.stringify(detail, null, 2) : null;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0C0C0C;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0C0C;padding:24px 0;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td style="background:#161616;border:1px solid ${color};border-radius:12px 12px 0 0;padding:20px 24px;">
    <span style="display:inline-block;background:${color};color:#fff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;padding:4px 10px;border-radius:20px;">${escapeHtml(sevLabel)}</span>
    <span style="color:#8c8578;font-size:12px;margin-left:8px;">${escapeHtml(catLabel)} · ${escapeHtml(source)}</span>
    <h1 style="font-size:18px;color:#F2F2F2;margin:14px 0 0;">${escapeHtml(message)}</h1>
  </td></tr>
  <tr><td style="background:#161616;border-left:1px solid #2a2a2a;border-right:1px solid #2a2a2a;padding:16px 24px;color:#8c8578;font-size:12.5px;">
    <p style="margin:0 0 8px;">Fecha: ${escapeHtml(fecha)}</p>
    ${orderId ? `<p style="margin:0 0 8px;">Orden: <code>${escapeHtml(orderId)}</code></p>` : ''}
    ${eventId ? `<p style="margin:0 0 8px;">Evento #${escapeHtml(eventId)}</p>` : ''}
    ${detailStr ? `<pre style="background:#0C0C0C;border:1px solid #2a2a2a;border-radius:8px;padding:12px;font-size:11px;color:#F0D080;overflow-x:auto;white-space:pre-wrap;word-break:break-word;">${escapeHtml(detailStr)}</pre>` : ''}
  </td></tr>
  <tr><td style="background:#161616;border:1px solid #2a2a2a;border-radius:0 0 12px 12px;padding:16px 24px;text-align:center;">
    <a href="https://iac-arica.cl/stamper-admin.html" style="color:#F0D080;font-size:12.5px;">Ver en el panel admin →</a>
  </td></tr>
</table></td></tr></table>
</body></html>`;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `IAC Arica — Monitoreo <${RESEND_FROM}>`,
        to: [ALERT_EMAIL_TO],
        subject: `[${sevLabel}] ${catLabel}: ${message}`.slice(0, 150),
        html,
      }),
    });
    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error (send-alert-email):', err);
      return new Response(JSON.stringify({ error: err }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const data = await resendRes.json();
    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('Error send-alert-email:', e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
