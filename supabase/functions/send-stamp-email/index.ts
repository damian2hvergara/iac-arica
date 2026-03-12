/**
 * send-stamp-email
 * ─────────────────────────────────────────────────────────────
 * Edge Function de IAC Arica — Envío de email de confirmación
 * de compra de estampillas digitales.
 *
 * DISPARO: Database Webhook en tabla `estampillas` → INSERT
 *
 * LÓGICA DE AGRUPAMIENTO:
 *   El webhook se dispara por cada fila insertada. Para evitar
 *   enviar N emails cuando alguien compra un pack de N estampillas,
 *   la función espera 3 segundos y luego agrupa todas las filas
 *   del mismo (email + sorteo_id) creadas en los últimos 10 segundos.
 *   Solo envía UN email con todas las estampillas del pack.
 *
 * ESCALA: Diseñada para 30.000+ ventas. Usa Resend con dominio
 *   verificado, sin dependencias externas ni librerías pesadas.
 *
 * SECRETS requeridos en Supabase → Settings → Edge Functions:
 *   RESEND_API_KEY   → re_XXXXXXXXXXXXXXXX
 *   RESEND_FROM      → noreply@iac-arica.cl
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/* ── Tipos ─────────────────────────────────────────────────── */
interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: EstampillaRow;
  schema: string;
  old_record: EstampillaRow | null;
}

interface EstampillaRow {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  pack: string;
  monto_pack: number;
  numero_folio: string;
  hash_seguridad: string;
  orden_en_pack: number;
  total_en_pack: number;
  vehicle_id: string | null;
  sorteo_id: string | null;
  estado: string;
  modo_pago: string;
  created_at: string;
}

interface VehicleRow {
  id: string;
  name: string;
  price: number;
  vehicle_images: { image_url: string; order_index: number }[];
}

interface SorteoRow {
  id: string;
  nombre_sorteo: string;
  fecha_sorteo: string;
}

/* ── Handler principal ─────────────────────────────────────── */
Deno.serve(async (req: Request) => {

  /* Solo aceptar POST */
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  /* Verificar secret del webhook (opcional pero recomendado) */
  const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
  if (webhookSecret) {
    const authHeader = req.headers.get('x-webhook-secret');
    if (authHeader !== webhookSecret) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  /* Solo procesar INSERT en tabla estampillas */
  if (payload.type !== 'INSERT' || payload.table !== 'estampillas') {
    return new Response('Ignored', { status: 200 });
  }

  const row = payload.record;

  /* No enviar email para compras de prueba en modo simulación
     Cambiar a false cuando Flow.cl esté activo */
  const SKIP_SIMULATION = false; // ← cambiar a true en producción
  if (SKIP_SIMULATION && row.modo_pago === 'simulacion') {
    console.log(`[skip] Simulación para ${row.email}`);
    return new Response('Skipped simulation', { status: 200 });
  }

  /* Esperar 3 segundos para que se inserten todas las filas del pack */
  await delay(3000);

  /* Inicializar cliente Supabase con service_role */
  const sbUrl  = Deno.env.get('SUPABASE_URL')!;
  const sbKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb     = createClient(sbUrl, sbKey);

  /* ── Agrupar todas las estampillas del pack ─────────────── */
  // Buscar todas las filas del mismo email + sorteo_id
  // creadas en los últimos 10 segundos (= mismo pack)
  const ventanaMs  = 10_000;
  const creadoEn   = new Date(row.created_at).getTime();
  const desde      = new Date(creadoEn - ventanaMs).toISOString();
  const hasta      = new Date(creadoEn + ventanaMs).toISOString();

  const { data: todasLasFilas, error: fetchError } = await sb
    .from('estampillas')
    .select('*')
    .eq('email', row.email)
    .eq('sorteo_id', row.sorteo_id)
    .gte('created_at', desde)
    .lte('created_at', hasta)
    .order('orden_en_pack', { ascending: true });

  if (fetchError || !todasLasFilas?.length) {
    console.error('Error fetching estampillas:', fetchError);
    return new Response('DB error', { status: 500 });
  }

  /* Deduplicar por numero_folio (por si el webhook se dispara varias veces) */
  const unique = new Map<string, EstampillaRow>();
  for (const f of todasLasFilas) unique.set(f.numero_folio, f);
  const estampillas = Array.from(unique.values())
    .sort((a, b) => a.orden_en_pack - b.orden_en_pack);

  /* Solo enviar email cuando procesamos la PRIMERA estampilla del pack
     (orden_en_pack === 1) para evitar emails duplicados */
  if (row.orden_en_pack !== 1) {
    console.log(`[skip] Fila ${row.orden_en_pack} de ${row.total_en_pack} — email ya enviado`);
    return new Response('Not first in pack', { status: 200 });
  }

  /* ── Cargar datos del vehículo y sorteo ─────────────────── */
  let vehicle: VehicleRow | null = null;
  let sorteo: SorteoRow  | null = null;

  if (row.vehicle_id) {
    const { data } = await sb
      .from('vehicles')
      .select('id, name, price, vehicle_images(image_url, order_index)')
      .eq('id', row.vehicle_id)
      .single();
    vehicle = data;
  }

  if (row.sorteo_id) {
    const { data } = await sb
      .from('sorteo_config')
      .select('id, nombre_sorteo, fecha_sorteo')
      .eq('id', row.sorteo_id)
      .single();
    sorteo = data;
  }

  /* ── Construir y enviar email ───────────────────────────── */
  const resendKey  = Deno.env.get('RESEND_API_KEY')!;
  const fromEmail  = Deno.env.get('RESEND_FROM') ?? 'noreply@iac-arica.cl';

  const vehicleName = vehicle?.name ?? 'Vehículo';
  const vehicleImg  = vehicle?.vehicle_images
    ?.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))[0]?.image_url ?? null;

  const fechaSorteo = sorteo?.fecha_sorteo
    ? new Date(sorteo.fecha_sorteo).toLocaleDateString('es-CL', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : 'Por confirmar';

  const html = buildEmailHTML({
    nombre:       row.nombre,
    email:        row.email,
    pack:         row.pack,
    monto:        row.monto_pack,
    estampillas,
    vehicleName,
    vehicleImg,
    fechaSorteo,
  });

  const subject = estampillas.length === 1
    ? `🏆 Tu estampilla IAC — Folio ${estampillas[0].numero_folio}`
    : `🏆 Tus ${estampillas.length} estampillas IAC — ${vehicleName}`;

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    `Import American Cars <${fromEmail}>`,
      to:      [row.email],
      subject,
      html,
      /* reply_to opcional */
      reply_to: 'contacto@iac-arica.cl',
      /* Tags para analytics en Resend */
      tags: [
        { name: 'pack',      value: row.pack },
        { name: 'modo_pago', value: row.modo_pago },
      ],
    }),
  });

  if (!resendRes.ok) {
    const errBody = await resendRes.text();
    console.error('Resend error:', resendRes.status, errBody);
    return new Response('Email error', { status: 500 });
  }

  const resendData = await resendRes.json();
  console.log(`[ok] Email enviado a ${row.email} — id: ${resendData.id}`);
  return new Response(JSON.stringify({ ok: true, resend_id: resendData.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

/* ── Helpers ───────────────────────────────────────────────── */

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const PACK_LABELS: Record<string, string> = {
  inicio:        'Pack Inicio',
  popular:       'Pack Popular',
  coleccionista: 'Pack Coleccionista',
};

/* ── HTML del Email ────────────────────────────────────────── */
interface EmailData {
  nombre: string;
  email: string;
  pack: string;
  monto: number;
  estampillas: EstampillaRow[];
  vehicleName: string;
  vehicleImg: string | null;
  fechaSorteo: string;
}

function buildEmailHTML(d: EmailData): string {
  const packLabel = PACK_LABELS[d.pack] ?? d.pack;
  const montoStr  = d.monto.toLocaleString('es-CL');
  const wspMsg    = encodeURIComponent(
    `🏆 ¡Estoy participando en el sorteo del ${d.vehicleName} de @importamericancars!\n\n` +
    `Mis folios:\n${d.estampillas.map(e => `  · ${e.numero_folio}`).join('\n')}\n\n` +
    `¡Consigue los tuyos → iac-arica.cl/stamper.html 🚗`
  );

  const stampCards = d.estampillas.map((e, i) => `
    <!-- Estampilla ${i + 1} -->
    <table width="100%" cellpadding="0" cellspacing="0" style="
      background: linear-gradient(140deg, #1c0b03 0%, #0d0d0d 100%);
      border-radius: 12px;
      border: 1px solid #2a2a2a;
      margin-bottom: 14px;
      overflow: hidden;
    ">
      <tr>
        <td style="padding: 0;">

          <!-- Header de la tarjeta -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="
                padding: 10px 16px;
                border-bottom: 1px solid #2a2a2a;
                font-family: monospace;
              ">
                <span style="color: #F0D080; font-size: 14px; font-weight: 700; letter-spacing: 1px;">
                  ${e.numero_folio}
                </span>
                <span style="color: #00C566; font-size: 11px; float: right; line-height: 1.8;">
                  Participación #${e.orden_en_pack}
                </span>
              </td>
            </tr>
          </table>

          <!-- Imagen del vehículo -->
          ${d.vehicleImg ? `
          <img src="${d.vehicleImg}" alt="${d.vehicleName}"
            width="100%" style="
              display: block;
              width: 100%;
              height: 160px;
              object-fit: cover;
              border-bottom: 1px solid #2a2a2a;
            "
          >` : ''}

          <!-- Cuerpo de la estampilla -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding: 14px 16px;">

                <!-- País + sello -->
                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
                  <tr>
                    <td style="
                      font-family: 'Courier New', monospace;
                      font-size: 10px; font-weight: 700;
                      color: rgba(201,168,76,0.65);
                      letter-spacing: 2px; text-transform: uppercase;
                    ">CHILE · ARICA</td>
                    <td align="right">
                      <span style="
                        display: inline-block;
                        width: 28px; height: 28px;
                        border-radius: 50%;
                        border: 2px solid rgba(155,0,0,0.5);
                        text-align: center; line-height: 26px;
                        font-family: 'Arial Black', sans-serif;
                        font-size: 9px; font-weight: 900;
                        color: rgba(155,0,0,0.8);
                      ">IAC</span>
                    </td>
                  </tr>
                </table>

                <!-- Nombre vehículo -->
                <p style="
                  font-family: 'Arial Black', 'Arial Bold', sans-serif;
                  font-size: 18px; font-weight: 900;
                  color: #FFFFFF; text-align: center;
                  margin: 0 0 3px; letter-spacing: 0.5px;
                  text-transform: uppercase;
                ">${d.vehicleName}</p>

                <p style="
                  font-family: 'Courier New', monospace;
                  font-size: 9px; color: rgba(240,208,128,0.6);
                  text-align: center; letter-spacing: 1.5px;
                  text-transform: uppercase; margin: 0 0 12px;
                ">COLECCIÓN CHILE NORTE · EDICIÓN LIMITADA</p>

                <!-- Línea separadora -->
                <hr style="border: none; border-top: 1px solid rgba(201,168,76,0.2); margin: 0 0 12px;">

                <!-- Sorteo + Folio -->
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <p style="font-family: 'Courier New', monospace; font-size: 9px;
                        color: rgba(255,255,255,0.35); text-transform: uppercase;
                        letter-spacing: 0.5px; margin: 0 0 2px;">SORTEO</p>
                      <p style="font-family: Arial, sans-serif; font-size: 11px;
                        color: rgba(255,255,255,0.75); font-weight: 600; margin: 0;">
                        ${d.fechaSorteo}
                      </p>
                    </td>
                    <td align="right">
                      <p style="font-family: 'Courier New', monospace; font-size: 9px;
                        color: rgba(240,208,128,0.45); text-transform: uppercase;
                        letter-spacing: 0.5px; margin: 0 0 2px;">FOLIO</p>
                      <p style="font-family: 'Courier New', monospace; font-size: 13px;
                        color: #F0D080; font-weight: 700; margin: 0;">
                        ${e.numero_folio}
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Propietario + Hash -->
                <p style="
                  font-family: 'Courier New', monospace;
                  font-size: 9px; color: rgba(255,255,255,0.22);
                  text-align: center; margin: 10px 0 0;
                ">Propietario: ${d.nombre} · Hash: ${e.hash_seguridad}</p>

              </td>
            </tr>
          </table>

        </td>
      </tr>
    </table>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>Tus Estampillas IAC</title>
</head>
<body style="
  margin: 0; padding: 0;
  background-color: #0C0C0C;
  font-family: Arial, Helvetica, sans-serif;
  -webkit-font-smoothing: antialiased;
">

<!-- Wrapper -->
<table width="100%" cellpadding="0" cellspacing="0" style="background: #0C0C0C; padding: 32px 0;">
<tr><td align="center">

<!-- Contenedor principal (600px máximo, 100% en móvil) -->
<table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px;">

  <!-- HEADER -->
  <tr>
    <td style="
      background: linear-gradient(135deg, #161616 0%, #1a0a02 100%);
      border: 1px solid #2a2a2a;
      border-radius: 16px 16px 0 0;
      padding: 32px 28px 24px;
      text-align: center;
    ">
      <!-- Logo -->
      <p style="
        font-family: 'Arial Black', 'Arial Bold', sans-serif;
        font-size: 22px; font-weight: 900;
        color: #FFFFFF; margin: 0 0 6px; letter-spacing: 0.5px;
      "><span style="color: #9B0000;">Import</span> American Cars</p>

      <p style="
        font-family: 'Courier New', monospace;
        font-size: 10px; color: rgba(201,168,76,0.7);
        letter-spacing: 2px; text-transform: uppercase;
        margin: 0 0 24px;
      ">ARICA · CHILE</p>

      <!-- Ícono check -->
      <div style="
        width: 64px; height: 64px; border-radius: 50%;
        background: rgba(0,197,102,0.15);
        border: 2px solid rgba(0,197,102,0.4);
        margin: 0 auto 16px;
        text-align: center; line-height: 62px;
        font-size: 28px;
      ">✅</div>

      <h1 style="
        font-family: 'Arial Black', 'Arial Bold', sans-serif;
        font-size: 26px; font-weight: 900;
        color: #FFFFFF; margin: 0 0 8px;
      ">¡Tus estampillas están listas!</h1>

      <p style="
        font-size: 14px; color: #6E6E6E;
        margin: 0; line-height: 1.6;
      ">
        Hola <strong style="color: #F2F2F2;">${d.nombre}</strong>,
        recibiste <strong style="color: #F0D080;">${d.estampillas.length} estampilla${d.estampillas.length > 1 ? 's' : ''}</strong>
        del ${packLabel}.<br>
        Guarda este email — es tu comprobante oficial de participación.
      </p>
    </td>
  </tr>

  <!-- BANNER SORTEO -->
  <tr>
    <td style="
      background: rgba(155,0,0,0.12);
      border-left: 1px solid #2a2a2a;
      border-right: 1px solid #2a2a2a;
      padding: 14px 28px;
    ">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="font-size: 11px; color: #9B0000; text-transform: uppercase;
              letter-spacing: 1px; margin: 0 0 3px; font-weight: 700;">🏆 Premio del sorteo</p>
            <p style="font-family: 'Arial Black', sans-serif; font-size: 18px;
              color: #FFFFFF; margin: 0; font-weight: 900;">${d.vehicleName}</p>
          </td>
          <td align="right">
            <p style="font-size: 11px; color: #6E6E6E; margin: 0 0 3px;">Fecha sorteo</p>
            <p style="font-size: 13px; color: #F0D080; font-weight: 700;
              margin: 0; font-family: 'Courier New', monospace;">${d.fechaSorteo}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ESTAMPILLAS -->
  <tr>
    <td style="
      background: #161616;
      border-left: 1px solid #2a2a2a;
      border-right: 1px solid #2a2a2a;
      padding: 24px 20px;
    ">
      <p style="
        font-family: 'Arial Black', sans-serif;
        font-size: 14px; font-weight: 900;
        color: #FFFFFF; margin: 0 0 16px;
        text-transform: uppercase; letter-spacing: 0.5px;
      ">📋 Tus estampillas numeradas</p>

      ${stampCards}

    </td>
  </tr>

  <!-- RESUMEN COMPRA -->
  <tr>
    <td style="
      background: #161616;
      border-left: 1px solid #2a2a2a;
      border-right: 1px solid #2a2a2a;
      padding: 0 20px 20px;
    ">
      <table width="100%" cellpadding="0" cellspacing="0" style="
        background: #202020;
        border: 1px solid #2a2a2a;
        border-radius: 10px;
        overflow: hidden;
      ">
        <tr>
          <td colspan="2" style="
            padding: 10px 14px 8px;
            border-bottom: 1px solid #2a2a2a;
            font-size: 11px; font-weight: 700;
            color: #6E6E6E; text-transform: uppercase; letter-spacing: 0.8px;
          ">Resumen de compra</td>
        </tr>
        <tr>
          <td style="padding: 8px 14px; font-size: 13px; color: #6E6E6E; border-bottom: 1px solid #2a2a2a;">Pack</td>
          <td style="padding: 8px 14px; font-size: 13px; color: #F2F2F2; text-align: right; border-bottom: 1px solid #2a2a2a; font-weight: 600;">${packLabel}</td>
        </tr>
        <tr>
          <td style="padding: 8px 14px; font-size: 13px; color: #6E6E6E; border-bottom: 1px solid #2a2a2a;">Estampillas</td>
          <td style="padding: 8px 14px; font-size: 13px; color: #F2F2F2; text-align: right; border-bottom: 1px solid #2a2a2a; font-weight: 600;">${d.estampillas.length}</td>
        </tr>
        <tr>
          <td style="padding: 8px 14px; font-size: 13px; color: #6E6E6E; border-bottom: 1px solid #2a2a2a;">Participaciones</td>
          <td style="padding: 8px 14px; font-size: 13px; color: #F2F2F2; text-align: right; border-bottom: 1px solid #2a2a2a; font-weight: 600;">${d.estampillas.length}</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; font-size: 14px; font-weight: 700; color: #F2F2F2;">Total pagado</td>
          <td style="padding: 10px 14px; font-size: 20px; font-weight: 900; color: #FFFFFF;
            text-align: right; font-family: 'Arial Black', sans-serif;">$${montoStr}</td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- BOTÓN WHATSAPP -->
  <tr>
    <td style="
      background: #161616;
      border-left: 1px solid #2a2a2a;
      border-right: 1px solid #2a2a2a;
      padding: 0 20px 24px;
      text-align: center;
    ">
      <p style="font-size: 13px; color: #6E6E6E; margin: 0 0 14px; line-height: 1.6;">
        Comparte tu participación con tus amigos 👇
      </p>
      <a href="https://wa.me/?text=${wspMsg}"
        style="
          display: inline-block;
          background: #25D366;
          color: #000000;
          font-family: 'Arial Black', sans-serif;
          font-size: 15px; font-weight: 900;
          padding: 14px 28px;
          border-radius: 999px;
          text-decoration: none;
          letter-spacing: 0.3px;
        ">
        💬 Compartir en WhatsApp
      </a>
    </td>
  </tr>

  <!-- INFO SEGURIDAD -->
  <tr>
    <td style="
      background: rgba(59,130,246,0.06);
      border: 1px solid #2a2a2a;
      border-top: 1px solid rgba(59,130,246,0.15);
      padding: 16px 20px;
    ">
      <p style="font-size: 12px; color: #6E6E6E; margin: 0; line-height: 1.7;">
        🔒 <strong style="color: #F2F2F2;">Seguridad del folio:</strong>
        Cada estampilla tiene un código de seguridad SHA-256 único e irrepetible.
        El folio y el hash son verificables en <a href="https://iac-arica.cl/verificar" style="color: #3B82F6;">iac-arica.cl/verificar</a>.<br><br>
        📋 <strong style="color: #F2F2F2;">Conserva este email</strong> como comprobante oficial de participación en el sorteo.
      </p>
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="
      background: #161616;
      border: 1px solid #2a2a2a;
      border-radius: 0 0 16px 16px;
      padding: 20px 28px;
      text-align: center;
    ">
      <p style="
        font-family: 'Arial Black', sans-serif;
        font-size: 16px; font-weight: 900;
        color: #FFFFFF; margin: 0 0 6px;
      "><span style="color: #9B0000;">Import</span> American Cars</p>

      <p style="font-size: 11px; color: #3E3E3E; margin: 0; line-height: 1.8;">
        Arica, Chile ·
        <a href="https://iac-arica.cl" style="color: #6E6E6E; text-decoration: none;">iac-arica.cl</a>
        · <a href="https://iac-arica.cl/bases" style="color: #6E6E6E; text-decoration: none;">Bases del sorteo</a>
        <br>
        Sorteo sujeto a Bases publicadas. Promoción Comercial con Premio — Ley 19.496.<br>
        Si no solicitaste estas estampillas, ignora este email.
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>

</body>
</html>
  `;
}
