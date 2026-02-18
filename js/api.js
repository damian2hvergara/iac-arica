/* ========================================
   api.js - Cliente API para Supabase
   VERSIÓN FUSIONADA:
   - Soporta tabla vehicle_images separada (nueva BD)
   - Soporta columna images[] directa en vehicles (BD simple)
   - CRUD completo de vehículos, imágenes y kits
   ======================================== */

class VehicleAPI {
    constructor() {
        this.client = null;
    }

    init() {
        this.client = initSupabase();
        if (!this.client) throw new Error('No se pudo inicializar Supabase');
        return this;
    }

    // ====================================
    // VEHÍCULOS - LEER
    // ====================================

    async getAllVehicles(status = null) {
        try {
            let query = this.client
                .from('vehicles')
                .select(`
                    *,
                    vehicle_images (id, image_url, is_main, order_index),
                    customization_kits (
                        id, kit_id, name, level, price, description, image_url,
                        kit_features (id, feature, order_index)
                    )
                `)
                .order('created_at', { ascending: false });

            if (status) query = query.eq('status', status);

            const { data, error } = await query;
            if (error) throw error;
            return data.map(v => this.formatVehicle(v));
        } catch (error) {
            console.error('Error getAllVehicles:', error);
            throw error;
        }
    }

    async getVehicle(id) {
        try {
            const { data, error } = await this.client
                .from('vehicles')
                .select(`
                    *,
                    vehicle_images (id, image_url, is_main, order_index),
                    customization_kits (
                        id, kit_id, name, level, price, description, image_url,
                        kit_features (id, feature, order_index)
                    )
                `)
                .eq('id', id)
                .single();

            if (error) throw error;
            return this.formatVehicle(data);
        } catch (error) {
            console.error('Error getVehicle:', error);
            throw error;
        }
    }

    async getStats() {
        try {
            const { data, error } = await this.client
                .from('vehicles')
                .select('status');
            if (error) throw error;
            return {
                total:   data.length,
                stock:   data.filter(v => v.status === 'stock').length,
                transit: data.filter(v => v.status === 'transit').length,
                reserve: data.filter(v => v.status === 'reserve').length
            };
        } catch (error) {
            console.error('Error getStats:', error);
            throw error;
        }
    }

    // ====================================
    // VEHÍCULOS - ESCRIBIR
    // ====================================

    async createVehicle(vehicleData) {
        try {
            const { data, error } = await this.client
                .from('vehicles')
                .insert([vehicleData])
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error createVehicle:', error);
            throw error;
        }
    }

    async updateVehicle(id, vehicleData) {
        try {
            const { data, error } = await this.client
                .from('vehicles')
                .update(vehicleData)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updateVehicle:', error);
            throw error;
        }
    }

    async deleteVehicle(id) {
        try {
            const { error } = await this.client
                .from('vehicles')
                .delete()
                .eq('id', id);
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleteVehicle:', error);
            throw error;
        }
    }

    // ====================================
    // IMÁGENES
    // ====================================

    async addImage(vehicleId, imageUrl, isMain = false, orderIndex = 0) {
        try {
            const { data, error } = await this.client
                .from('vehicle_images')
                .insert([{ vehicle_id: vehicleId, image_url: imageUrl, is_main: isMain, order_index: orderIndex }])
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error addImage:', error);
            throw error;
        }
    }

    async deleteImage(imageId) {
        try {
            const { error } = await this.client
                .from('vehicle_images')
                .delete()
                .eq('id', imageId);
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleteImage:', error);
            throw error;
        }
    }

    async setMainImage(vehicleId, imageId) {
        try {
            await this.client.from('vehicle_images').update({ is_main: false }).eq('vehicle_id', vehicleId);
            const { data, error } = await this.client
                .from('vehicle_images')
                .update({ is_main: true })
                .eq('id', imageId)
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error setMainImage:', error);
            throw error;
        }
    }

    // ====================================
    // KITS DE PERSONALIZACIÓN
    // ====================================

    async getVehicleKits(vehicleId) {
        try {
            const { data, error } = await this.client
                .from('customization_kits')
                .select('*, kit_features (id, feature, order_index)')
                .eq('vehicle_id', vehicleId)
                .order('level', { ascending: true });
            if (error) throw error;
            return data.map(kit => ({
                ...kit,
                features: (kit.kit_features || [])
                    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                    .map(f => f.feature)
            }));
        } catch (error) {
            console.error('Error getVehicleKits:', error);
            throw error;
        }
    }

    async createKit(kitData) {
        try {
            const { data, error } = await this.client
                .from('customization_kits')
                .insert([kitData])
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error createKit:', error);
            throw error;
        }
    }

    async updateKit(kitId, kitData) {
        try {
            const { data, error } = await this.client
                .from('customization_kits')
                .update(kitData)
                .eq('id', kitId)
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updateKit:', error);
            throw error;
        }
    }

    async deleteKit(kitId) {
        try {
            const { error } = await this.client
                .from('customization_kits')
                .delete()
                .eq('id', kitId);
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleteKit:', error);
            throw error;
        }
    }

    async updateKitFeatures(kitId, features) {
        try {
            await this.client.from('kit_features').delete().eq('kit_id', kitId);
            if (features && features.length > 0) {
                const { data, error } = await this.client
                    .from('kit_features')
                    .insert(features.map((f, i) => ({ kit_id: kitId, feature: f, order_index: i })))
                    .select();
                if (error) throw error;
                return data;
            }
            return [];
        } catch (error) {
            console.error('Error updateKitFeatures:', error);
            throw error;
        }
    }

    // ====================================
    // AUTENTICACIÓN
    // ====================================

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
            return true;
        } catch (error) {
            console.error('Error signOut:', error);
            throw error;
        }
    }

    async getCurrentUser() {
        try {
            const { data: { user } } = await this.client.auth.getUser();
            return user;
        } catch {
            return null;
        }
    }

    // ====================================
    // FORMATEAR VEHÍCULO
    // Soporta ambos esquemas:
    //   - vehicle_images[] (tabla separada, BD nueva)
    //   - images[] (columna directa, BD simple)
    // ====================================
    formatVehicle(vehicle) {
        if (!vehicle) return null;

        // ── Imágenes ──────────────────────────────────────
        let gallery = [];

        // Opción A: tabla vehicle_images separada (BD nueva)
        if (vehicle.vehicle_images && vehicle.vehicle_images.length > 0) {
            gallery = vehicle.vehicle_images
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                .map(img => img.image_url)
                .filter(Boolean);
        }
        // Opción B: columna images[] directa en vehicles (BD simple / anterior)
        else if (vehicle.images) {
            let raw = vehicle.images;
            if (typeof raw === 'string') {
                try { raw = JSON.parse(raw); } catch { raw = [raw]; }
            }
            if (Array.isArray(raw)) {
                gallery = raw.map(img => this._normalizeImageUrl(img)).filter(Boolean);
            }
        }

        const baseImage = gallery[0]
            || 'https://res.cloudinary.com/df2gprqhp/image/upload/v1765988412/CHEVROLET_yjwbxt.jpg';

        // ── Kits ──────────────────────────────────────────
        const kits = (vehicle.customization_kits || []).map(kit => ({
            ...kit,
            features: (kit.kit_features || [])
                .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                .map(f => f.feature)
        }));

        // ── Especificaciones (seguro contra null) ─────────
        const specifications = {
            motor:       vehicle.motor       || null,
            potencia:    vehicle.potencia     || null,
            torque:      vehicle.torque       || null,
            transmision: vehicle.transmision  || null,
            traccion:    vehicle.traccion     || null,
            combustible: vehicle.combustible  || null,
            consumo:     vehicle.consumo      || null,
            capacidad:   vehicle.capacidad    || null,
            color:       vehicle.color        || null,
            kilometraje: vehicle.kilometraje  || null
        };
        const hasSpecs = Object.values(specifications).some(v => v !== null);

        return {
            ...vehicle,
            gallery,
            baseImage,
            kits,
            specifications,
            hasSpecs,
            shareCount: vehicle.share_count || 0,
            viewCount:  vehicle.view_count  || 0
        };
    }

    // Convierte public_id de Cloudinary a URL completa
    _normalizeImageUrl(raw) {
        if (!raw || typeof raw !== 'string') return null;
        const t = raw.trim();
        if (t.startsWith('http://') || t.startsWith('https://')) return t;
        return `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload/${t}`;
    }
}

const vehicleAPI = new VehicleAPI();
window.vehicleAPI = vehicleAPI;

console.log('✅ API Client cargado');
