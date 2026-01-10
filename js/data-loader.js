// Carga y normalización de datos desde Google Apps Script
class DataLoader {
    static async load() {
        try {
            console.log('🔄 Conectando a base de datos...');
            
            const response = await fetch(CONFIG.API_URL, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (!data || typeof data !== 'object') {
                throw new Error('Respuesta no válida');
            }
            
            // Normalizar datos
            this.normalizeData(data);
            
            console.log(`✅ Datos cargados: ${CONFIG.STATE.vehicles.length} vehículos`);
            return true;
            
        } catch (error) {
            console.error('❌ Error cargando datos:', error.message);
            this.loadFallbackData();
            return false;
        }
    }
    
    static normalizeData(data) {
        // Contador importados
        CONFIG.STATE.importedCounter = CONFIG.safeParseInt(
            data.importedCounter || data.importedVehiclesCounter,
            CONFIG.DEFAULT_IMPORTED_COUNT
        );
        
        // WhatsApp
        CONFIG.STATE.whatsappNumber = CONFIG.safeString(
            data.whatsapp || data.whatsappNumber,
            CONFIG.DEFAULT_WHATSAPP
        );
        
        // Vehículos (formato compatible con tu app original)
        CONFIG.STATE.vehicles = Array.isArray(data.vehicles) 
            ? data.vehicles.map(v => ({
                id: CONFIG.safeParseInt(v.id),
                name: CONFIG.safeString(v.name, 'Vehículo'),
                price: CONFIG.safeParseInt(v.price),
                status: CONFIG.safeString(v.status, 'stock').toLowerCase(),
                location: CONFIG.safeString(v.location, 'Arica'),
                type: CONFIG.safeString(v.type, 'vehicle'),
                description: CONFIG.safeString(v.description, 'Vehículo americano importado'),
                eta: CONFIG.safeString(v.eta, 'Disponible'),
                transitTime: v.transitTime || v.transit_days ? CONFIG.safeParseInt(v.transitTime || v.transit_days) : null,
                baseImage: CONFIG.safeString(v.baseImage || v.images?.[0], 'https://images.unsplash.com/photo-1580274455191-1c62238fa333?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'),
                gallery: Array.isArray(v.gallery) ? v.gallery : 
                         Array.isArray(v.images) ? v.images : [],
                videoId: v.videoId || null,
                specifications: v.specifications || {},
                kits: Array.isArray(v.kits) ? v.kits : []
            }))
            : [];
        
        // Asegurar que todos los vehículos tengan al menos una imagen
        CONFIG.STATE.vehicles.forEach(v => {
            if (!v.gallery || v.gallery.length === 0) {
                v.gallery = [v.baseImage];
            }
        });
        
        // Actualizar contador en UI
        const counterEl = document.getElementById('importedVehiclesCounter');
        if (counterEl) {
            counterEl.textContent = CONFIG.STATE.importedCounter;
        }
        
        // Actualizar enlaces de WhatsApp
        this.updateWhatsappLinks();
    }
    
    static loadFallbackData() {
        console.log('⚠️ Usando datos de respaldo');
        CONFIG.STATE.vehicles = [];
        CONFIG.STATE.importedCounter = CONFIG.DEFAULT_IMPORTED_COUNT;
        CONFIG.STATE.whatsappNumber = CONFIG.DEFAULT_WHATSAPP;
    }
    
    static updateWhatsappLinks() {
        const whatsappBtn = document.getElementById('whatsappButton');
        if (whatsappBtn) {
            whatsappBtn.href = `https://wa.me/${CONFIG.STATE.whatsappNumber}`;
        }
    }
    
    static getVehicles() {
        return CONFIG.STATE.vehicles;
    }
    
    static getVehicleById(id) {
        return CONFIG.STATE.vehicles.find(v => v.id === id);
    }
}

// Hacer disponible globalmente
window.DataLoader = DataLoader;
