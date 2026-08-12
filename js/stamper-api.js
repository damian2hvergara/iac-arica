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
    // "verificando tu pago" al volver desde Flow. No requiere email
    // porque el UUID de la orden no es adivinable.
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

    // Confirmación simulada de pago Flow — solo mientras Flow.cl no está
    // conectado de verdad (ver supabase/migrations/2026_sorteo_rebuild_part3.sql).
    async confirmarOrdenSimulado(ordenId) {
        try {
            const { data, error } = await this.client
                .rpc('confirmar_orden_simulado', { p_orden_id: ordenId });
            if (error) throw error;
            return data; // [{numero_folio, hash_seguridad, orden_en_pack}, ...]
        } catch (error) {
            console.error('Error confirmarOrdenSimulado:', error);
            throw error;
        }
    }

    // Progreso del referente hacia su próxima estampilla bonus
    // (1 cada 4 compradas con su código) — se usa para avisarle por correo.
    async infoReferido(codigoReferido) {
        try {
            const { data, error } = await this.client
                .rpc('info_referido', { p_codigo_referido: codigoReferido });
            if (error) throw error;
            return data && data[0];
        } catch (error) {
            console.error('Error infoReferido:', error);
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

    async confirmarOrden(ordenId) {
        try {
            const { data, error } = await this.client
                .rpc('confirmar_orden', { p_orden_id: ordenId });
            if (error) throw error;
            return data; // [{numero_folio, hash_seguridad, orden_en_pack}, ...]
        } catch (error) {
            console.error('Error confirmarOrden:', error);
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
                .select('estado, monto_total, cantidad_stickers, pack_id, created_at, packs_config(nombre)');
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

            return { ordenes, sorteo, stickersVendidos };
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

    // Sorteo config — lectura/escritura admin.
    // Devuelve null (no lanza error) si todavía no existe ningún sorteo —
    // caso normal la primera vez que se configura el admin.
    async getSorteoConfigAdmin() {
        try {
            const { data, error } = await this.client
                .from('sorteo_config')
                .select('*, vehicles(name, price, vehicle_images(image_url, is_main))')
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
