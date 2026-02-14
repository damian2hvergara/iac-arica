/* ========================================
   api.js - Cliente API para Supabase
   MEJORADO: Con métodos completos para kits
   ======================================== */

class VehicleAPI {
    constructor() {
        this.client = null;
    }
    
    init() {
        this.client = initSupabase();
        if (!this.client) {
            throw new Error('No se pudo inicializar Supabase');
        }
        return this;
    }
    
    // ====================================
    // VEHÍCULOS
    // ====================================
    
    async getAllVehicles(status = null) {
        try {
            let query = this.client
                .from('vehicles')
                .select(`
                    *,
                    vehicle_images (id, image_url, is_main, order_index),
                    customization_kits (id, kit_id, name, level, price, description, image_url)
                `)
                .order('created_at', { ascending: false });
            
            if (status) query = query.eq('status', status);
            
            const { data, error } = await query;
            if (error) throw error;
            
            return data.map(v => this.formatVehicle(v));
        } catch (error) {
            console.error('Error:', error);
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
            console.error('Error:', error);
            throw error;
        }
    }
    
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
            console.error('Error:', error);
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
            console.error('Error:', error);
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
            console.error('Error:', error);
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
                .insert([{
                    vehicle_id: vehicleId,
                    image_url: imageUrl,
                    is_main: isMain,
                    order_index: orderIndex
                }])
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error:', error);
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
            console.error('Error:', error);
            throw error;
        }
    }
    
    async setMainImage(vehicleId, imageId) {
        try {
            await this.client
                .from('vehicle_images')
                .update({ is_main: false })
                .eq('vehicle_id', vehicleId);
            
            const { data, error } = await this.client
                .from('vehicle_images')
                .update({ is_main: true })
                .eq('id', imageId)
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }
    
    // ====================================
    // KITS DE PERSONALIZACIÓN
    // ====================================
    
    // NUEVO: Obtener todos los kits (sin filtrar por vehículo)
    async getAllKits() {
        try {
            const { data, error } = await this.client
                .from('customization_kits')
                .select(`
                    *,
                    kit_features (id, feature, order_index)
                `)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            return data.map(kit => ({
                ...kit,
                features: (kit.kit_features || [])
                    .sort((a, b) => a.order_index - b.order_index)
                    .map(f => f.feature)
            }));
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }
    
    // Obtener kits de un vehículo específico
    async getVehicleKits(vehicleId) {
        try {
            const { data, error } = await this.client
                .from('customization_kits')
                .select(`
                    *,
                    kit_features (id, feature, order_index)
                `)
                .eq('vehicle_id', vehicleId)
                .order('level', { ascending: true });
            
            if (error) throw error;
            
            return data.map(kit => ({
                ...kit,
                features: (kit.kit_features || [])
                    .sort((a, b) => a.order_index - b.order_index)
                    .map(f => f.feature)
            }));
        } catch (error) {
            console.error('Error:', error);
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
            console.error('Error:', error);
            throw error;
        }
    }
    
    // NUEVO: Actualizar kit
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
            console.error('Error:', error);
            throw error;
        }
    }
    
    // NUEVO: Eliminar kit
    async deleteKit(kitId) {
        try {
            // Las features se eliminan automáticamente por CASCADE
            const { error } = await this.client
                .from('customization_kits')
                .delete()
                .eq('id', kitId);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }
    
    // ====================================
    // FEATURES DE KITS
    // ====================================
    
    async addKitFeature(kitId, feature, orderIndex = 0) {
        try {
            const { data, error } = await this.client
                .from('kit_features')
                .insert([{
                    kit_id: kitId,
                    feature: feature,
                    order_index: orderIndex
                }])
                .select()
                .single();
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }
    
    // NUEVO: Eliminar feature
    async deleteKitFeature(featureId) {
        try {
            const { error } = await this.client
                .from('kit_features')
                .delete()
                .eq('id', featureId);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }
    
    // NUEVO: Actualizar features de un kit (elimina todas y crea nuevas)
    async updateKitFeatures(kitId, features) {
        try {
            // Eliminar features existentes
            await this.client
                .from('kit_features')
                .delete()
                .eq('kit_id', kitId);
            
            // Insertar nuevas features
            if (features && features.length > 0) {
                const featuresData = features.map((feature, index) => ({
                    kit_id: kitId,
                    feature: feature,
                    order_index: index
                }));
                
                const { data, error } = await this.client
                    .from('kit_features')
                    .insert(featuresData)
                    .select();
                
                if (error) throw error;
                return data;
            }
            
            return [];
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }
    
    // ====================================
    // ESTADÍSTICAS
    // ====================================
    
    async getStats() {
        try {
            const { data: vehicles, error } = await this.client
                .from('vehicles')
                .select('status');
            
            if (error) throw error;
            
            return {
                total: vehicles.length,
                stock: vehicles.filter(v => v.status === 'stock').length,
                transit: vehicles.filter(v => v.status === 'transit').length,
                reserve: vehicles.filter(v => v.status === 'reserve').length
            };
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }
    
    // ====================================
    // AUTENTICACIÓN
    // ====================================
    
    async signIn(email, password) {
        try {
            const { data, error } = await this.client.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }
    
    async signOut() {
        try {
            const { error } = await this.client.auth.signOut();
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }
    
    async getCurrentUser() {
        try {
            const { data: { user } } = await this.client.auth.getUser();
            return user;
        } catch (error) {
            return null;
        }
    }
    
    // ====================================
    // UTILIDADES
    // ====================================
    
    formatVehicle(vehicle) {
        if (!vehicle) return null;
        
        const images = vehicle.vehicle_images || [];
        const kits = vehicle.customization_kits || [];
        
        return {
            ...vehicle,
            gallery: images
                .sort((a, b) => a.order_index - b.order_index)
                .map(img => img.image_url),
            baseImage: images.find(img => img.is_main)?.image_url || 
                      images[0]?.image_url || 
                      'https://via.placeholder.com/800x600?text=Sin+Imagen',
            kits: kits.map(kit => ({
                ...kit,
                features: (kit.kit_features || [])
                    .sort((a, b) => a.order_index - b.order_index)
                    .map(f => f.feature)
            })),
            specifications: {
                motor: vehicle.motor,
                potencia: vehicle.potencia,
                torque: vehicle.torque,
                transmision: vehicle.transmision,
                traccion: vehicle.traccion,
                combustible: vehicle.combustible,
                consumo: vehicle.consumo,
                capacidad: vehicle.capacidad,
                color: vehicle.color,
                kilometraje: vehicle.kilometraje
            }
        };
    }
}

const vehicleAPI = new VehicleAPI();

if (typeof window !== 'undefined') {
    window.vehicleAPI = vehicleAPI;
    window.VehicleAPI = VehicleAPI;
}

console.log('✅ API Client cargado - Versión mejorada con gestión completa de kits');
