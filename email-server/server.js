const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Middlewares ─────────────────────────────────────────── */
app.use(express.json());
app.use(cors({
  origin: [
    'https://iac-arica.cl',
    'https://www.iac-arica.cl',
    'http://localhost',
    'http://127.0.0.1'
  ],
  methods: ['POST'],
}));

/* ── Health check ────────────────────────────────────────── */
app.get('/', (req, res) => {
  res.json({ ok: true, service: 'IAC Email Server' });
});

/* ── Endpoint principal ──────────────────────────────────── */
app.post('/send-email', async (req, res) => {
  const { nombre, email, estampillas, vehicleName, vehicleImg, fechaSorteo, pack, monto } = req.body;

  /* Validación básica */
  if (!email || !nombre || !estampillas?.length) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY no configurada' });
  }

  const PACK_LABELS = {
    inicio:        'Pack Inicio',
    popular:       'Pack Popular',
    coleccionista: 'Pack Coleccionista',
  };
  const packLabel = PACK_LABELS[pack] || pack;
  const montoStr  = Number(monto).toLocaleString('es-CL');

  const wspMsg = encodeURIComponent(
    `🏆 ¡Estoy participando en el sorteo del ${vehicleName} de @importamericancars!\n\n` +
    `Mis folios:\n${estampillas.map(e => `  · ${e.folio}`).join('\n')}\n\n` +
    `¡Consigue los tuyos → iac-arica.cl/stamper.html 🚗`
  );

  const stampCards = estampillas.map((e, i) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(140deg,#1c0b03,#0d0d0d);border-radius:12px;border:1px solid #2a2a2a;margin-bottom:14px;">
      <tr><td style="padding:10px 16px;border-bottom:1px solid #2a2a2a;">
        <span style="color:#F0D080;font-family:monospace;font-size:14px;font-weight:700;letter-spacing:1px;">${e.folio}</span>
        <span style="color:#00C566;font-size:11px;float:right;line-height:1.8;">Participación #${i + 1}</span>
      </td></tr>
      ${vehicleImg ? `<tr><td><img src="${vehicleImg}" width="100%" style="display:block;height:150px;object-fit:cover;"></td></tr>` : ''}
      <tr><td style="padding:14px 16px;">
        <p style="font-family:monospace;font-size:10px;font-weight:700;color:rgba(201,168,76,0.65);letter-spacing:2px;margin:0 0 8px;">CHILE · ARICA</p>
        <p style="font-family:'Arial Black',sans-serif;font-size:18px;font-weight:900;color:#fff;text-align:center;margin:0 0 3px;text-transform:uppercase;">${vehicleName}</p>
        <p style="font-family:monospace;font-size:9px;color:rgba(240,208,128,0.6);text-align:center;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 12px;">COLECCIÓN CHILE NORTE · EDICIÓN LIMITADA</p>
        <hr style="border:none;border-top:1px solid rgba(201,168,76,0.2);margin:0 0 12px;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td>
            <p style="font-family:monospace;font-size:9px;color:rgba(255,255,255,0.35);text-transform:uppercase;margin:0 0 2px;">SORTEO</p>
            <p style="font-size:11px;color:rgba(255,255,255,0.75);font-weight:600;margin:0;">${fechaSorteo}</p>
          </td>
          <td align="right">
            <p style="font-family:monospace;font-size:9px;color:rgba(240,208,128,0.45);text-transform:uppercase;margin:0 0 2px;">FOLIO</p>
            <p style="font-family:monospace;font-size:13px;color:#F0D080;font-weight:700;margin:0;">${e.folio}</p>
          </td>
        </tr></table>
        <p style="font-family:monospace;font-size:9px;color:rgba(255,255,255,0.22);text-align:center;margin:10px 0 0;">Hash: ${e.hash}</p>
      </td></tr>
    </table>`).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0C0C0C;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0C0C0C;padding:32px 0;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

  <tr><td style="background:linear-gradient(135deg,#161616,#1a0a02);border:1px solid #2a2a2a;border-radius:16px 16px 0 0;padding:32px 28px 24px;text-align:center;">
    <p style="font-family:'Arial Black',sans-serif;font-size:22px;font-weight:900;color:#fff;margin:0 0 6px;"><span style="color:#9B0000;">Import</span> American Cars</p>
    <p style="font-family:monospace;font-size:10px;color:rgba(201,168,76,0.7);letter-spacing:2px;text-transform:uppercase;margin:0 0 24px;">ARICA · CHILE</p>
    <div style="width:64px;height:64px;border-radius:50%;background:rgba(0,197,102,0.15);border:2px solid rgba(0,197,102,0.4);margin:0 auto 16px;text-align:center;line-height:62px;font-size:28px;">✅</div>
    <h1 style="font-family:'Arial Black',sans-serif;font-size:26px;font-weight:900;color:#fff;margin:0 0 8px;">¡Tus estampillas están listas!</h1>
    <p style="font-size:14px;color:#6E6E6E;margin:0;line-height:1.6;">
      Hola <strong style="color:#F2F2F2;">${nombre}</strong>, recibiste
      <strong style="color:#F0D080;">${estampillas.length} estampilla${estampillas.length > 1 ? 's' : ''}</strong> del ${packLabel}.<br>
      Guarda este email como comprobante oficial de participación.
    </p>
  </td></tr>

  <tr><td style="background:rgba(155,0,0,0.12);border-left:1px solid #2a2a2a;border-right:1px solid #2a2a2a;padding:14px 28px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><p style="font-size:11px;color:#9B0000;text-transform:uppercase;letter-spacing:1px;margin:0 0 3px;font-weight:700;">🏆 Premio del sorteo</p>
        <p style="font-family:'Arial Black',sans-serif;font-size:18px;color:#fff;margin:0;font-weight:900;">${vehicleName}</p></td>
      <td align="right"><p style="font-size:11px;color:#6E6E6E;margin:0 0 3px;">Fecha sorteo</p>
        <p style="font-family:monospace;font-size:13px;color:#F0D080;font-weight:700;margin:0;">${fechaSorteo}</p></td>
    </tr></table>
  </td></tr>

  <tr><td style="background:#161616;border-left:1px solid #2a2a2a;border-right:1px solid #2a2a2a;padding:24px 20px;">
    <p style="font-family:'Arial Black',sans-serif;font-size:14px;font-weight:900;color:#fff;margin:0 0 16px;text-transform:uppercase;letter-spacing:0.5px;">📋 Tus estampillas numeradas</p>
    ${stampCards}
  </td></tr>

  <tr><td style="background:#161616;border-left:1px solid #2a2a2a;border-right:1px solid #2a2a2a;padding:0 20px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#202020;border:1px solid #2a2a2a;border-radius:10px;">
      <tr><td colspan="2" style="padding:10px 14px 8px;border-bottom:1px solid #2a2a2a;font-size:11px;font-weight:700;color:#6E6E6E;text-transform:uppercase;letter-spacing:0.8px;">Resumen de compra</td></tr>
      <tr><td style="padding:8px 14px;font-size:13px;color:#6E6E6E;border-bottom:1px solid #2a2a2a;">Pack</td>
          <td style="padding:8px 14px;font-size:13px;color:#F2F2F2;text-align:right;border-bottom:1px solid #2a2a2a;font-weight:600;">${packLabel}</td></tr>
      <tr><td style="padding:8px 14px;font-size:13px;color:#6E6E6E;border-bottom:1px solid #2a2a2a;">Estampillas</td>
          <td style="padding:8px 14px;font-size:13px;color:#F2F2F2;text-align:right;border-bottom:1px solid #2a2a2a;font-weight:600;">${estampillas.length}</td></tr>
      <tr><td style="padding:10px 14px;font-size:14px;font-weight:700;color:#F2F2F2;">Total pagado</td>
          <td style="padding:10px 14px;font-size:20px;font-weight:900;color:#fff;text-align:right;font-family:'Arial Black',sans-serif;">$${montoStr}</td></tr>
    </table>
  </td></tr>

  <tr><td style="background:#161616;border-left:1px solid #2a2a2a;border-right:1px solid #2a2a2a;padding:0 20px 24px;text-align:center;">
    <p style="font-size:13px;color:#6E6E6E;margin:0 0 14px;">Comparte tu participación con tus amigos 👇</p>
    <a href="https://wa.me/?text=${wspMsg}" style="display:inline-block;background:#25D366;color:#000;font-family:'Arial Black',sans-serif;font-size:15px;font-weight:900;padding:14px 28px;border-radius:999px;text-decoration:none;">💬 Compartir en WhatsApp</a>
  </td></tr>

  <tr><td style="background:#161616;border:1px solid #2a2a2a;border-radius:0 0 16px 16px;padding:20px 28px;text-align:center;">
    <p style="font-family:'Arial Black',sans-serif;font-size:16px;font-weight:900;color:#fff;margin:0 0 6px;"><span style="color:#9B0000;">Import</span> American Cars</p>
    <p style="font-size:11px;color:#3E3E3E;margin:0;line-height:1.8;">
      Arica, Chile · <a href="https://iac-arica.cl" style="color:#6E6E6E;text-decoration:none;">iac-arica.cl</a> ·
      <a href="https://iac-arica.cl/bases" style="color:#6E6E6E;text-decoration:none;">Bases del sorteo</a><br>
      Si no solicitaste estas estampillas, ignora este email.
    </p>
  </td></tr>

</table></td></tr></table>
</body></html>`;

  const subject = estampillas.length === 1
    ? `🏆 Tu estampilla IAC — Folio ${estampillas[0].folio}`
    : `🏆 Tus ${estampillas.length} estampillas IAC — ${vehicleName}`;

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:     'Import American Cars <noreply@iac-arica.cl>',
        to:       [email],
        subject,
        html,
        reply_to: 'contacto@iac-arica.cl',
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      console.error('Resend error:', err);
      return res.status(500).json({ error: 'Error enviando email', detail: err });
    }

    const data = await resendRes.json();
    console.log(`[ok] Email enviado a ${email} — id: ${data.id}`);
    return res.json({ ok: true, id: data.id });

  } catch (e) {
    console.error('fetch error:', e);
    return res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`IAC Email Server corriendo en puerto ${PORT}`);
});
