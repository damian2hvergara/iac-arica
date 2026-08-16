/**
 * _shared/log-event.ts — IAC Arica 2026
 *
 * Primer módulo compartido entre Edge Functions de este repo — hasta
 * ahora cada función es 100% autocontenida (CORS/json()/escapeHtml se
 * repiten en cada archivo). Se hace una excepción acá a propósito:
 * sin esto, la lógica de deduplicación + disparo de correo (~30
 * líneas) habría que copiarla en 8-10 archivos distintos y mantenerla
 * sincronizada en todos — el costo de duplicar supera el de romper la
 * convención una vez.
 *
 * logEvent(): registra un evento en system_events y, si la severidad
 * es high/critical y no se avisó por el mismo origen+categoría en los
 * últimos 30 minutos, dispara un correo inmediato vía send-alert-email.
 * Nunca lanza — si loggear falla, no debe tumbar el flujo real (un
 * pago, un correo) que la está llamando.
 *
 * logRepeatedAttempt(): para casos tipo "401/403 repetido" o "secreto
 * equivocado" — solo escala a la severidad "alta" (con correo) desde
 * el intento N en una ventana de tiempo; antes de eso queda como
 * severidad baja, sin correo (evita alertar por un solo típeo/sesión
 * vencida).
 */

type Category = 'error' | 'payment' | 'security' | 'abuse' | 'info';
type Severity = 'low' | 'medium' | 'high' | 'critical';

interface LogEventOpts {
  category: Category;
  severity: Severity;
  source: string;
  message: string;
  detail?: Record<string, unknown> | null;
  orderId?: string | null;
}

export async function logEvent(supabase: any, opts: LogEventOpts): Promise<void> {
  try {
    const { data: eventId, error } = await supabase.rpc('log_system_event', {
      p_category: opts.category,
      p_severity: opts.severity,
      p_source: opts.source,
      p_message: opts.message,
      p_detail: opts.detail ?? null,
      p_order_id: opts.orderId ?? null,
    });
    if (error) {
      console.error('logEvent: no se pudo insertar en system_events:', error);
      return;
    }

    if (opts.severity !== 'high' && opts.severity !== 'critical') return;

    const { data: yaAvisado } = await supabase.rpc('hubo_alerta_reciente', {
      p_source: opts.source, p_category: opts.category, p_minutos: 30,
    });
    if (yaAvisado) return;

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-alert-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        category: opts.category, severity: opts.severity, source: opts.source,
        message: opts.message, detail: opts.detail, eventId, orderId: opts.orderId,
      }),
    });
    if (res.ok) {
      await supabase.from('system_events').update({ notified_at: new Date().toISOString() }).eq('id', eventId);
    } else {
      console.error('logEvent: send-alert-email respondió', res.status, await res.text());
    }
  } catch (e) {
    console.error('logEvent: error inesperado (no se propaga):', e);
  }
}

interface RepeatedAttemptOpts {
  source: string;
  message: string;
  detail?: Record<string, unknown> | null;
  windowMinutes?: number;
  threshold?: number;
}

export async function logRepeatedAttempt(supabase: any, opts: RepeatedAttemptOpts): Promise<void> {
  const windowMinutes = opts.windowMinutes ?? 10;
  const threshold = opts.threshold ?? 3;
  try {
    const { data: countPrevios } = await supabase.rpc('contar_eventos_recientes', {
      p_source: opts.source, p_category: 'security', p_minutos: windowMinutes,
    });
    const severity: Severity = ((countPrevios ?? 0) + 1 >= threshold) ? 'high' : 'low';
    await logEvent(supabase, {
      category: 'security', severity, source: opts.source, message: opts.message, detail: opts.detail,
    });
  } catch (e) {
    console.error('logRepeatedAttempt: error inesperado (no se propaga):', e);
  }
}
