/* ========================================
   api.js - Cliente Supabase
   Import American Cars
   ======================================== */

class VehicleAPI {
    constructor() {
        this.client = supabase.createClient(
            APP_CONFIG.supabase.url,
            APP_CONFIG.supabase.anonKey
        );
        this.realtimeSubscription = null;
    }

    // ====================================
    // VEHÍCULOS
    // ====================================

    /**
     * Obtener todos los vehículos
     */
    async getVehicles() {
        try {
            const { data, error } = await this.client
                .from('vehicles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data.map(v => this.formatVehicle(v));
        } catch (error) {
            console.error('Error fetching vehicles:', error);
            return [];
        }
    }

    /**
     * Obtener un vehículo por ID
     */
    async getVehicleById(id) {
        try {
            const { data, error } = await this.client
                .from('vehicles')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            return this.formatVehicle(data);
        } catch (error) {
            console.error('Error fetching vehicle:', error);
            return null;
        }
    }

    /**
     * Incrementar contador de vistas
     */
    async incrementViewCount(vehicleId) {
        try {
            const { error } = await this.client.rpc('increment_view_count', {
                vehicle_id: vehicleId
            });
            
            // Si la función RPC no existe, hacemos update directo
            if (error) {
                const { data: vehicle } = await this.client
                    .from('vehicles')
                    .select('view_count')
                    .eq('id', vehicleId)
                    .single();
                
                await this.client
                    .from('vehicles')
                    .update({ view_count: (vehicle?.view_count || 0) + 1 })
                    .eq('id', vehicleId);
            }
        } catch (error) {
            console.error('Error incrementing view count:', error);
        }
    }

    /**
     * Incrementar contador de compartidos
     */
    async incrementShareCount(vehicleId) {
        try {
            const { data: vehicle } = await this.client
                .from('vehicles')
                .select('share_count')
                .eq('id', vehicleId)
                .single();
            
            await this.client
                .from('vehicles')
                .update({ share_count: (vehicle?.share_count || 0) + 1 })
                .eq('id', vehicleId);
        } catch (error) {
            console.error('Error incrementing share count:', error);
        }
    }

    /**
     * Normalizar URL de imagen de Cloudinary.
     * Acepta cualquier formato:
     *   - URL completa ya correcta  → la devuelve igual
     *   - public_id relativo         → construye la URL completa
     *   - versión con /upload/v123/  → la devuelve igual
     */
    normalizeCloudinaryUrl(raw) {
        if (!raw || typeof raw !== 'string') return null;

        const raw_trim = raw.trim();

        // Ya es una URL completa (http / https)
        if (raw_trim.startsWith('http://') || raw_trim.startsWith('https://')) {
            return raw_trim;
        }

        // Es un public_id relativo, ej: "vehicles/foto" o "import_cars/foto.jpg"
        const cloudName = APP_CONFIG.cloudinary.cloudName; // df2gprqhp
        return `https://res.cloudinary.com/${cloudName}/image/upload/${raw_trim}`;
    }

    /**
     * Normalizar array de imágenes, filtrando nulos/vacíos
     */
    normalizeImages(rawImages) {
        if (!rawImages) return [];

        // Puede venir como string JSON, array, o string simple
        let arr = rawImages;

        if (typeof rawImages === 'string') {
            try {
                arr = JSON.parse(rawImages);
            } catch {
                // Si no parsea, tratar como una sola URL
                arr = [rawImages];
            }
        }

        if (!Array.isArray(arr)) return [];

        return arr
            .map(img => this.normalizeCloudinaryUrl(img))
            .filter(Boolean);
    }

    /**
     * Formatear vehículo desde BD
     */
    formatVehicle(vehicle) {
        if (!vehicle) return null;

        // Detectar tipo si no está definido
        const type = vehicle.type || this.detectVehicleType(vehicle.name);

        // Normalizar imágenes (maneja rutas relativas, URLs completas, JSON strings)
        const images = this.normalizeImages(vehicle.images);
        const mainImage = images[0] || 'https://res.cloudinary.com/df2gprqhp/image/upload/v1765988412/CHEVROLET_yjwbxt.jpg';

        return {
            id: vehicle.id,
            name: vehicle.name || '',
            year: vehicle.year || new Date().getFullYear(),
            price: vehicle.price || 0,
            priceAnchor: vehicle.price_anchor || null,
            priceUsa: vehicle.price_usa || null,
            status: vehicle.status || 'stock',
            type: type,
            description: vehicle.description || '',
            specs: vehicle.specs || '',
            images: images,
            mainImage: mainImage,
            arrivalDate: vehicle.arrival_date || null,
            viewCount: vehicle.view_count || 0,
            shareCount: vehicle.share_count || 0,
            createdAt: vehicle.created_at
        };
    }

    /**
     * Detectar tipo de vehículo por nombre
     */
    detectVehicleType(name) {
        if (!name) return 'pickup';
        const nameLower = name.toLowerCase();
        
        for (const [typeId, typeConfig] of Object.entries(APP_CONFIG.vehicleTypes)) {
            if (typeId === 'all') continue;
            for (const keyword of typeConfig.keywords) {
                if (nameLower.includes(keyword.toLowerCase())) {
                    return typeId;
                }
            }
        }
        
        return 'pickup'; // Default
    }

    // ====================================
    // TESTIMONIOS
    // ====================================

    /**
     * Obtener todos los testimonios
     */
    async getTestimonials() {
        try {
            const { data, error } = await this.client
                .from('testimonials')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching testimonials:', error);
            return [];
        }
    }

    /**
     * Obtener testimonio por tipo de vehículo
     */
    async getTestimonialByType(type) {
        try {
            const { data, error } = await this.client
                .from('testimonials')
                .select('*')
                .eq('vehicle_type', type)
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        } catch (error) {
            console.error('Error fetching testimonial by type:', error);
            return null;
        }
    }

    // ====================================
    // ENTREGAS RECIENTES
    // ====================================

    /**
     * Obtener entregas recientes
     */
    async getDeliveries(limit = 3) {
        try {
            const { data, error } = await this.client
                .from('deliveries')
                .select('*')
                .order('delivery_date', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching deliveries:', error);
            return [];
        }
    }

    // ====================================
    // MÉTRICAS DE CONFIANZA
    // ====================================

    /**
     * Obtener métricas de confianza
     */
    async getTrustMetrics() {
        try {
            const { data, error } = await this.client
                .from('trust_metrics')
                .select('*');

            if (error) throw error;
            
            // Convertir a objeto
            const metrics = {};
            (data || []).forEach(item => {
                metrics[item.metric_key] = item.metric_value;
            });
            
            return metrics;
        } catch (error) {
            console.error('Error fetching trust metrics:', error);
            return {
                imported_count: '142',
                google_rating: '4.9',
                avg_days: '45',
                satisfaction: '100',
                complaints: '0'
            };
        }
    }

    // ====================================
    // FAQs
    // ====================================

    /**
     * Obtener FAQs activas
     */
    async getFAQs() {
        try {
            const { data, error } = await this.client
                .from('faqs')
                .select('*')
                .eq('is_active', true)
                .order('order_index', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching FAQs:', error);
            return [];
        }
    }

    // ====================================
    // ACTIVIDAD EN TIEMPO REAL
    // ====================================

    /**
     * Registrar actividad
     */
    async logActivity(actionType, data = {}) {
        try {
            const activityData = {
                action_type: actionType,
                user_name: data.userName || null,
                user_avatar: data.userAvatar || null,
                vehicle_id: data.vehicleId || null,
                vehicle_name: data.vehicleName || null,
                city: data.city || null
            };

            const { error } = await this.client
                .from('activity_log')
                .insert(activityData);

            if (error) throw error;
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    }

    /**
     * Obtener actividad reciente
     */
    async getRecentActivity(limit = 10) {
        try {
            const { data, error } = await this.client
                .from('activity_log')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching activity:', error);
            return [];
        }
    }

    /**
     * Suscribirse a actividad en tiempo real
     */
    subscribeToActivity(callback) {
        this.realtimeSubscription = this.client
            .channel('activity-channel')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'activity_log'
                },
                (payload) => {
                    if (callback && typeof callback === 'function') {
                        callback(payload.new);
                    }
                }
            )
            .subscribe();

        return this.realtimeSubscription;
    }

    /**
     * Cancelar suscripción a tiempo real
     */
    unsubscribeFromActivity() {
        if (this.realtimeSubscription) {
            this.client.removeChannel(this.realtimeSubscription);
            this.realtimeSubscription = null;
        }
    }

    // ====================================
    // ADMIN - CRUD VEHÍCULOS
    // ====================================

    /**
     * Crear vehículo
     */
    async createVehicle(vehicleData) {
        try {
            const { data, error } = await this.client
                .from('vehicles')
                .insert({
                    name: vehicleData.name,
                    year: vehicleData.year,
                    price: vehicleData.price,
                    price_anchor: vehicleData.priceAnchor || null,
                    price_usa: vehicleData.priceUsa || null,
                    status: vehicleData.status || 'stock',
                    type: vehicleData.type || 'pickup',
                    description: vehicleData.description || '',
                    specs: vehicleData.specs || '',
                    images: vehicleData.images || [],
                    arrival_date: vehicleData.arrivalDate || null
                })
                .select()
                .single();

            if (error) throw error;
            return this.formatVehicle(data);
        } catch (error) {
            console.error('Error creating vehicle:', error);
            throw error;
        }
    }

    /**
     * Actualizar vehículo
     */
    async updateVehicle(id, vehicleData) {
        try {
            const updateData = {};
            
            if (vehicleData.name !== undefined) updateData.name = vehicleData.name;
            if (vehicleData.year !== undefined) updateData.year = vehicleData.year;
            if (vehicleData.price !== undefined) updateData.price = vehicleData.price;
            if (vehicleData.priceAnchor !== undefined) updateData.price_anchor = vehicleData.priceAnchor;
            if (vehicleData.priceUsa !== undefined) updateData.price_usa = vehicleData.priceUsa;
            if (vehicleData.status !== undefined) updateData.status = vehicleData.status;
            if (vehicleData.type !== undefined) updateData.type = vehicleData.type;
            if (vehicleData.description !== undefined) updateData.description = vehicleData.description;
            if (vehicleData.specs !== undefined) updateData.specs = vehicleData.specs;
            if (vehicleData.images !== undefined) updateData.images = vehicleData.images;
            if (vehicleData.arrivalDate !== undefined) updateData.arrival_date = vehicleData.arrivalDate;

            const { data, error } = await this.client
                .from('vehicles')
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;
            return this.formatVehicle(data);
        } catch (error) {
            console.error('Error updating vehicle:', error);
            throw error;
        }
    }

    /**
     * Eliminar vehículo
     */
    async deleteVehicle(id) {
        try {
            const { error } = await this.client
                .from('vehicles')
                .delete()
                .eq('id', id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error deleting vehicle:', error);
            throw error;
        }
    }
}

// Crear instancia global
const vehicleAPI = new VehicleAPI();
window.vehicleAPI = vehicleAPI;

/* ========================================
   FIN DE API.JS
   ======================================== */
