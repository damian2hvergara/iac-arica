/* ========================================
   stamper-api.js - Cliente API para el sorteo
   "IAC Arica 2026 — No Sueñes, Gánatelo"
   Usado por stamper.html (público) y
   stamper-admin.html (autenticado).

   IMPORTANTE: el sitio no tiene build step, así que los navegadores
   cachean este archivo agresivamente. Cada vez que se edite, subir
   también el número en "?v=" del <script src="js/stamper-api.js?v=...">
   en TODOS los HTML que lo cargan (stamper.html, stamper-admin.html,
   mi-cuenta.html, bases.html) — si no, algunos visitantes van a seguir
   ejecutando la versión vieja hasta que limpien caché manualmente.
   ======================================== */

class StamperAPI {
    constructor() {
        this.client = null;
    }

    init() {
        this.client = initSupabase();
        if (!this.client) throw new Error('No se pudo inicializar Supabase');
        return this;
    }

    // ====================================
    // PÚBLICO — sin sesión
    // ====================================

    // Devuelve null (no lanza error) si todavía no hay ningún sorteo activo
    // configurado — .single() explotaba con 0 o con más de una fila.
    async getSorteoPublico() {
        try {
            const { data, error } = await this.client
                .from('sorteo_publico')
                .select('*')
                .eq('activo', true)
                .order('id', { ascending: false })
                .limit(1);
            if (error) throw error;
            return (data && data[0]) || null;
        } catch (error) {
            console.error('Error getSorteoPublico:', error);
            throw error;
        }
    }

    async getPacks() {
        try {
            const { data, error } = await this.client
                .from('packs_config')
                .select('*')
                .eq('activo', true)
                .order('orden', { ascending: true });
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getPacks:', error);
            throw error;
        }
    }

    async getVehiclesStock() {
        try {
            const { data, error } = await this.client
                .from('vehicles')
                .select('id, name, price, vehicle_images(image_url, is_main, order_index)')
                .eq('status', 'stock')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getVehiclesStock:', error);
            throw error;
        }
    }

    async getVehiclePublico(vehicleId) {
        try {
            const { data, error } = await this.client
                .from('vehicles')
                .select('id, name, price, motor, potencia, torque, transmision, traccion, video_id, vehicle_images(image_url, is_main, order_index)')
                .eq('id', vehicleId)
                .single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getVehiclePublico:', error);
            throw error;
        }
    }

    // Estado mínimo de una orden por su UUID — usado en la pantalla de
    // "verificando tu pago" mientras se confirma con Mercado Pago. No
    // requiere email porque el UUID de la orden no es adivinable.
    async estadoOrdenPublico(ordenId) {
        try {
            const { data, error } = await this.client
                .rpc('estado_orden_publico', { p_orden_id: ordenId });
            if (error) throw error;
            return data && data[0];
        } catch (error) {
            console.error('Error estadoOrdenPublico:', error);
            throw error;
        }
    }

    async getStickersVendidos(sorteoId = null) {
        try {
            const { data, error } = await this.client
                .rpc('stickers_vendidos_count', { p_sorteo_id: sorteoId });
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getStickersVendidos:', error);
            throw error;
        }
    }

    async crearOrdenPendiente({ nombre, email, telefono, rutPasaporte, packSlug, referidoPor }) {
        try {
            const { data, error } = await this.client.rpc('create_pending_order', {
                p_nombre: nombre,
                p_email: email,
                p_telefono: telefono,
                p_rut_pasaporte: rutPasaporte,
                p_pack_slug: packSlug,
                p_referido_por: referidoPor || null
            });
            if (error) throw error;
            return data && data[0];
        } catch (error) {
            console.error('Error crearOrdenPendiente:', error);
            throw error;
        }
    }

    // Avisa al sistema de monitoreo de un error real del checkout (nunca
    // de una validación esperada, eso lo filtra el propio backend) — para
    // que un problema como "permission denied for function
    // create_pending_order" le llegue al dueño por correo en vez de
    // quedar solo en la consola del navegador de quien lo sufrió.
    // Nunca lanza ni bloquea el flujo real: si el reporte mismo falla,
    // se ignora en silencio.
    async reportClientError(errorType, error, extra = {}) {
        try {
            await fetch(`${SUPABASE_CONFIG.url}/functions/v1/report-client-error`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    errorType,
                    code: error?.code || error?.message || String(error || ''),
                    message: error?.message || String(error || ''),
                    ...extra
                })
            });
        } catch (e) {
            console.warn('No se pudo reportar el error al monitoreo:', e);
        }
    }

    // Nombre del referente (sin email) para el banner "fulano te invitó"
    // en el checkout — el resto de la lógica de aviso al referente
    // (email, progreso, bono) corre server-side en mp-webhook/mp-process-payment.
    async referenteNombrePublico(codigoReferido) {
        try {
            const { data, error } = await this.client
                .rpc('referente_nombre_publico', { p_codigo_referido: codigoReferido });
            if (error) throw error;
            return data && data[0];
        } catch (error) {
            console.error('Error referenteNombrePublico:', error);
            throw error;
        }
    }

    // Ranking público de referidores (nombre + inicial, sin cifras
    // globales del sorteo).
    async topReferidores(limite = 5) {
        try {
            const { data, error } = await this.client
                .rpc('top_referidores', { p_limit: limite });
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error topReferidores:', error);
            throw error;
        }
    }

    // Panel privado del referenciador: su posición exacta, cuánto le
    // falta para el podio, etc. Requiere correo + RUT/pasaporte (los
    // mismos datos con que compró) porque expone cuánto refirió en
    // comparación con otros — más sensible que solo ver sus stickers.
    async miRankingReferidos(email, rutPasaporte) {
        try {
            const { data, error } = await this.client
                .rpc('mi_ranking_referidos', { p_email: email, p_rut_pasaporte: rutPasaporte });
            if (error) throw error;
            return data && data[0];
        } catch (error) {
            console.error('Error miRankingReferidos:', error);
            throw error;
        }
    }

    // ====================================
    // ADMIN — requiere sesión autenticada
    // ====================================

    // Ranking de Referenciadores (cláusula Décimo Séptima) agrupado por
    // PERSONA, no por código individual — a diferencia de topReferidores
    // (público, cosmético), este es el que determina a quién se le paga
    // el premio en efectivo del Top 3, así que no puede fragmentar a
    // nadie en dos filas por tener más de un codigo_referido.
    async rankingReferenciadoresAdmin(limite = null) {
        try {
            const { data, error } = await this.client
                .rpc('ranking_referenciadores_admin', { p_limit: limite });
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error rankingReferenciadoresAdmin:', error);
            throw error;
        }
    }

    async compradoresSinReferir() {
        try {
            const { data, error } = await this.client.rpc('compradores_sin_referir');
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error compradoresSinReferir:', error);
            throw error;
        }
    }

    async getOrdenesPendientes() {
        try {
            const { data, error } = await this.client
                .from('ordenes')
                .select('*, packs_config(nombre)')
                .eq('estado', 'pendiente_pago')
                .order('created_at', { ascending: true });
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getOrdenesPendientes:', error);
            throw error;
        }
    }

    async getOrdenesAll() {
        try {
            const { data, error } = await this.client
                .from('ordenes')
                .select('*, packs_config(nombre)')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getOrdenesAll:', error);
            throw error;
        }
    }

    async rechazarOrden(ordenId, nota) {
        try {
            const { error } = await this.client
                .rpc('rechazar_orden', { p_orden_id: ordenId, p_nota: nota || null });
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error rechazarOrden:', error);
            throw error;
        }
    }

    // filtros: { categoria, severidad, resuelto } — cualquiera puede ir
    // null/undefined para no filtrar por ese campo. resuelto=false trae
    // solo pendientes, null trae todo.
    async getSystemEvents(filtros = {}) {
        try {
            let query = this.client
                .from('system_events')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200);
            if (filtros.categoria) query = query.eq('category', filtros.categoria);
            if (filtros.severidad) query = query.eq('severity', filtros.severidad);
            if (filtros.resuelto === false) query = query.eq('resolved', false);
            if (filtros.resuelto === true) query = query.eq('resolved', true);
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getSystemEvents:', error);
            throw error;
        }
    }

    async marcarEventoResuelto(eventId) {
        try {
            const { error } = await this.client.rpc('marcar_evento_resuelto', { p_id: eventId });
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error marcarEventoResuelto:', error);
            throw error;
        }
    }

    // Cláusula Tercera de las bases: sticker gratis para ganadores de
    // dinámicas de Instagram — sin compra, con su propio código de
    // referido. Admin-only (is_admin() lo valida server-side).
    async otorgarStickerGratis({ nombre, email, telefono, rutPasaporte, instagramHandle, dinamicaOrigen, fechaDinamica }) {
        try {
            const { data, error } = await this.client.rpc('otorgar_sticker_gratis', {
                p_nombre: nombre,
                p_email: email,
                p_telefono: telefono,
                p_rut_pasaporte: rutPasaporte,
                p_instagram_handle: instagramHandle || null,
                p_dinamica_origen: dinamicaOrigen,
                p_fecha_dinamica: fechaDinamica || null
            });
            if (error) throw error;
            return data && data[0];
        } catch (error) {
            console.error('Error otorgarStickerGratis:', error);
            throw error;
        }
    }

    async getStickersComprados(sorteoId = null) {
        try {
            const { data, error } = await this.client.rpc('stickers_comprados_count', { p_sorteo_id: sorteoId });
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getStickersComprados:', error);
            throw error;
        }
    }

    // filtros opcionales: { dinamica } — filtra por texto en dinamica_origen.
    async getGratisRedesSociales(filtros = {}) {
        try {
            let query = this.client
                .from('ordenes')
                .select('id, nombre, email, telefono, rut_pasaporte, instagram_handle, dinamica_origen, fecha_dinamica, otorgado_por, codigo_referido, created_at, estampillas(numero_folio)')
                .eq('tipo', 'gratis_redes_sociales')
                .order('created_at', { ascending: false });
            if (filtros.dinamica) query = query.ilike('dinamica_origen', `%${filtros.dinamica}%`);
            const { data, error } = await query;
            if (error) throw error;

            // Cantidad de referidos generados por cada uno (compras completadas
            // que usaron su código) — una sola consulta extra, no N+1.
            const codigos = (data || []).map(o => o.codigo_referido).filter(Boolean);
            let referidosPorCodigo = {};
            if (codigos.length) {
                const { data: referidos } = await this.client
                    .from('ordenes')
                    .select('referido_por')
                    .eq('estado', 'completado')
                    .in('referido_por', codigos);
                (referidos || []).forEach(r => {
                    referidosPorCodigo[r.referido_por] = (referidosPorCodigo[r.referido_por] || 0) + 1;
                });
            }
            return (data || []).map(o => ({ ...o, cantidad_referidos: referidosPorCodigo[o.codigo_referido] || 0 }));
        } catch (error) {
            console.error('Error getGratisRedesSociales:', error);
            throw error;
        }
    }

    // Un folio por fila, con su titular y tipo — para el CSV de impresión
    // de boletos físicos (cláusula Décima: mismo pool para todos los tipos).
    async getFoliosParaImprimir() {
        try {
            const { data, error } = await this.client
                .from('estampillas')
                .select('numero_folio, hash_seguridad, es_bonus, ordenes!inner(nombre, rut_pasaporte, email, telefono, tipo, codigo_referido, estado)')
                .eq('ordenes.estado', 'completado')
                .order('numero_folio', { ascending: true });
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getFoliosParaImprimir:', error);
            throw error;
        }
    }

    async getEstampillasPorOrden(ordenId) {
        try {
            const { data, error } = await this.client
                .from('estampillas')
                .select('numero_folio, hash_seguridad, orden_en_pack, es_bonus')
                .eq('orden_id', ordenId)
                .order('orden_en_pack', { ascending: true });
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getEstampillasPorOrden:', error);
            throw error;
        }
    }

    async getDashboardStats() {
        try {
            const { data: ordenes, error } = await this.client
                .from('ordenes')
                .select('estado, monto_total, cantidad_stickers, pack_id, referido_por, tipo, created_at, packs_config(nombre)');
            if (error) throw error;

            const { data: sorteoRows, error: errSorteo } = await this.client
                .from('sorteo_config')
                .select('meta_minima_stickers, total_stickers_emitidos')
                .eq('activo', true)
                .order('id', { ascending: false })
                .limit(1);
            if (errSorteo) throw errSorteo;
            const sorteo = (sorteoRows && sorteoRows[0]) || { meta_minima_stickers: 0, total_stickers_emitidos: 0 };

            const { data: stickersVendidos, error: errCount } = await this.client
                .rpc('stickers_vendidos_count', { p_sorteo_id: null });
            if (errCount) throw errCount;

            // Meta Mínima (cláusula Novena): solo cuenta comprado, nunca
            // bono por referido ni gratis por redes sociales.
            const { data: stickersComprados, error: errComprados } = await this.client
                .rpc('stickers_comprados_count', { p_sorteo_id: null });
            if (errComprados) throw errComprados;

            const { count: estampillasRegaladas, error: errBonus } = await this.client
                .from('estampillas')
                .select('id, ordenes!inner(estado)', { count: 'exact', head: true })
                .eq('es_bonus', true)
                .eq('ordenes.estado', 'completado');
            if (errBonus) throw errBonus;

            const { count: gratisRedesCount, error: errGratis } = await this.client
                .from('ordenes')
                .select('id', { count: 'exact', head: true })
                .eq('tipo', 'gratis_redes_sociales')
                .eq('estado', 'completado');
            if (errGratis) throw errGratis;

            return {
                ordenes, sorteo, stickersVendidos, stickersComprados,
                estampillasRegaladas: estampillasRegaladas || 0,
                estampillasGratisRedes: gratisRedesCount || 0
            };
        } catch (error) {
            console.error('Error getDashboardStats:', error);
            throw error;
        }
    }

    // Packs — CRUD admin
    async getPacksAdmin() {
        try {
            const { data, error } = await this.client
                .from('packs_config')
                .select('*')
                .order('orden', { ascending: true });
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getPacksAdmin:', error);
            throw error;
        }
    }

    async savePack(pack) {
        try {
            const { id, ...fields } = pack;
            if (id) {
                const { data, error } = await this.client
                    .from('packs_config').update(fields).eq('id', id).select().single();
                if (error) throw error;
                return data;
            }
            const { data, error } = await this.client
                .from('packs_config').insert([fields]).select().single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error savePack:', error);
            throw error;
        }
    }

    async deletePack(id) {
        try {
            const { error } = await this.client.from('packs_config').delete().eq('id', id);
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deletePack:', error);
            throw error;
        }
    }

    // Un pack con órdenes reales asociadas no se puede borrar (rompería
    // el historial de esas compras vía ordenes_pack_id_fkey) — desactivarlo
    // lo saca de la tienda sin tocar las órdenes ya hechas con él.
    async desactivarPack(id) {
        try {
            const { error } = await this.client.from('packs_config').update({ activo: false }).eq('id', id);
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error desactivarPack:', error);
            throw error;
        }
    }

    // Sorteo config — lectura/escritura admin.
    // Devuelve null (no lanza error) si todavía no existe ningún sorteo —
    // caso normal la primera vez que se configura el admin.
    async getSorteoConfigAdmin() {
        try {
            const { data, error } = await this.client
                .from('sorteo_config')
                .select('*, vehicles(name, price, vehicle_images(image_url, is_main, order_index))')
                .eq('activo', true)
                .order('id', { ascending: false })
                .limit(1);
            if (error) throw error;
            return (data && data[0]) || null;
        } catch (error) {
            console.error('Error getSorteoConfigAdmin:', error);
            throw error;
        }
    }

    async updateSorteoConfig(id, fields) {
        try {
            const { data, error } = await this.client
                .from('sorteo_config').update(fields).eq('id', id).select().single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updateSorteoConfig:', error);
            throw error;
        }
    }

    // Crea el primer sorteo (no existía ninguna fila activa todavía).
    // Desactiva cualquier fila activa vieja/huérfana por seguridad.
    async createSorteoConfig(fields) {
        try {
            await this.client.from('sorteo_config').update({ activo: false }).eq('activo', true);
            const { data, error } = await this.client
                .from('sorteo_config').insert([{ ...fields, activo: true }]).select().single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error createSorteoConfig:', error);
            throw error;
        }
    }

    // Auth (reutiliza el mismo patrón que VehicleAPI)
    async signIn(email, password) {
        try {
            const { data, error } = await this.client.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error signIn:', error);
            throw error;
        }
    }

    async signOut() {
        try {
            const { error } = await this.client.auth.signOut();
            if (error) throw error;
        } catch (error) {
            console.error('Error signOut:', error);
            throw error;
        }
    }

    async getCurrentUser() {
        try {
            const { data } = await this.client.auth.getUser();
            return data?.user || null;
        } catch (error) {
            console.error('Error getCurrentUser:', error);
            return null;
        }
    }
}

/**
 * Asigna una foto del vehículo por posición (0, 1, 2...) en vez de al azar,
 * para que dentro de un mismo grupo (los packs en pantalla, o las
 * estampillas de una misma orden) nunca se repita una foto mientras
 * queden fotos distintas sin usar. Si el grupo tiene más elementos que
 * fotos disponibles, recién ahí empieza a repetir en el mismo orden.
 * images: array de {image_url, order_index} (ya ordenado).
 * index: posición del elemento dentro de su grupo (0-based).
 */
function pickStickerImage(images, index) {
    if (!images || !images.length) return null;
    const i = Number.isInteger(index) ? index : 0;
    return images[i % images.length].image_url;
}

/**
 * Asigna la foto de una estampilla ya emitida a partir de su folio
 * (no de su posición en un array). Así la misma estampilla muestra
 * siempre la misma foto sin importar dónde se renderice — pantalla de
 * éxito, correo original, reenvío desde mi-cuenta, o el panel admin —
 * en vez de depender de que cada uno de esos lugares calcule el mismo
 * índice "i" sobre la misma lista de fotos en el mismo momento.
 * images: array de URLs (strings), ya ordenado.
 * folio: numero_folio de la estampilla (string).
 */
function pickStickerImageForFolio(images, folio) {
    if (!images || !images.length || !folio) return null;
    let hash = 0;
    for (let i = 0; i < folio.length; i++) {
        hash = (hash * 31 + folio.charCodeAt(i)) >>> 0;
    }
    return images[hash % images.length];
}

window.pickStickerImage = pickStickerImage;
window.pickStickerImageForFolio = pickStickerImageForFolio;
window.stamperAPI = new StamperAPI();
