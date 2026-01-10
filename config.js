// Configuración de la API
const API_URL = 'https://script.google.com/macros/s/AKfycbwVkFTK9bbMWMv7pcKcyaoBoUJVGx-V3wJm343TYeBmNtdhF0Kg-48Aa7ZDY8OXlsiU/exec';

// Variables globales
let vehicles = [];
let importedVehiclesCounter = 142;
let whatsappNumber = '56938654827';

// Google Analytics
(function() {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID';
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'GA_MEASUREMENT_ID');
    
    // Función para trackear eventos
    window.trackEvent = function(eventName, eventCategory, eventLabel) {
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, {
                'event_category': eventCategory,
                'event_label': eventLabel
            });
        }
    };
})();

// Función segura para parsear números
function safeParseInt(value, defaultValue = 0) {
    if (value === null || value === undefined || value === '') return defaultValue;
    const parsed = parseInt(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

// Función segura para obtener valor
function safeGet(obj, key, defaultValue = '') {
    if (!obj || typeof obj !== 'object') return defaultValue;
    return obj[key] !== undefined && obj[key] !== null && obj[key] !== '' 
        ? obj[key] 
        : defaultValue;
}

// Extraer ID de YouTube desde URL o ID
function extractYouTubeId(videoInput) {
    if (!videoInput) return null;
    
    // Si ya es un ID (11 caracteres)
    if (videoInput.length === 11 && !videoInput.includes('/')) {
        return videoInput;
    }
    
    // Si es una URL completa
    try {
        const url = new URL(videoInput);
        const hostname = url.hostname;
        
        if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
            if (hostname.includes('youtu.be')) {
                return url.pathname.slice(1); // Remover el slash inicial
            } else if (url.searchParams.has('v')) {
                return url.searchParams.get('v');
            }
        }
    } catch (e) {
        // Si no es una URL válida, devolver el input como está
        return videoInput;
    }
    
    return videoInput;
}

// Función para cargar datos desde Google Sheets API
async function loadDataFromAPI() {
    try {
        console.log('🔄 Conectando a la base de datos...');
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            // Procesar los datos según la estructura de tu API
            processAPIData(data.data);
            console.log('✅ Base de datos conectada:', vehicles.length, 'vehículos cargados');
            return true;
        } else {
            throw new Error(data.message || 'Error en la respuesta de la API');
        }
    } catch (error) {
        console.error('❌ No se pudo conectar a la base de datos:', error.message);
        console.log('ℹ️ La aplicación funcionará con datos mínimos');
        loadEmptyData();
        return false;
    }
}

// Procesar datos de la API de forma segura
function processAPIData(apiData) {
    if (!apiData) {
        loadEmptyData();
        return;
    }
    
    // 1. Configuración global
    if (Array.isArray(apiData.config)) {
        apiData.config.forEach(item => {
            if (item && item.key === 'imported_vehicles_counter') {
                importedVehiclesCounter = safeParseInt(item.value, 142);
            }
            if (item && item.key === 'whatsapp_number') {
                whatsappNumber = item.value || '56938654827';
            }
        });
    }
    
    // 2. Vehículos - Filtrar solo activos
    if (Array.isArray(apiData.vehicles)) {
        const activeVehicles = apiData.vehicles.filter(v => 
            v && v.active === 'TRUE'
        );
        
        if (activeVehicles.length === 0) {
            console.log('⚠️ No hay vehículos activos en la base de datos');
            loadEmptyData();
            return;
        }
        
        vehicles = activeVehicles.map(vehicle => {
            // Datos básicos del vehículo
            const baseData = {
                id: safeParseInt(vehicle.id, 0),
                name: safeGet(vehicle, 'name', 'Vehículo'),
                price: safeParseInt(vehicle.price_clp, 0),
                status: safeGet(vehicle, 'status', 'stock'),
                location: safeGet(vehicle, 'location', 'Arica'),
                type: 'vehicle', // Valor por defecto
                description: safeGet(vehicle, 'description', ''),
                eta: safeGet(vehicle, 'eta', 'Disponible'),
                transitTime: safeParseInt(vehicle.transit_days, null),
                baseImage: safeGet(vehicle, 'base_image', 'https://images.unsplash.com/photo-1580274455191-1c62238fa333?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80'),
                gallery: [],
                videoId: extractYouTubeId(vehicle.video_id),
                specifications: {},
                kits: []
            };
            
            // Determinar tipo del vehículo basado en el nombre
            const vehicleName = baseData.name.toLowerCase();
            if (vehicleName.includes('silverado')) baseData.type = 'silverado';
            else if (vehicleName.includes('tacoma')) baseData.type = 'tacoma';
            else if (vehicleName.includes('ram')) baseData.type = 'ram';
            else if (vehicleName.includes('jeep')) baseData.type = 'jeep';
            else if (vehicleName.includes('ford')) baseData.type = 'ford';
            
            // 3. Especificaciones técnicas
            if (Array.isArray(apiData.specifications)) {
                const vehicleSpecs = apiData.specifications.filter(spec => 
                    spec && spec.vehicle_id == baseData.id
                );
                
                vehicleSpecs.forEach(spec => {
                    if (spec.spec_key && spec.spec_value) {
                        baseData.specifications[spec.spec_key] = spec.spec_value;
                    }
                });
            }
            
            // 4. Galería de imágenes
            if (Array.isArray(apiData.gallery)) {
                const vehicleGallery = apiData.gallery
                    .filter(img => img && img.vehicle_id == baseData.id)
                    .sort((a, b) => safeParseInt(a.order, 0) - safeParseInt(b.order, 0));
                
                baseData.gallery = vehicleGallery.map(img => 
                    safeGet(img, 'image_url', baseData.baseImage)
                );
            }
            
            // Si no hay galería, usar la imagen base
            if (baseData.gallery.length === 0) {
                baseData.gallery = [baseData.baseImage];
            }
            
            // 5. Kits de personalización
            if (Array.isArray(apiData.kits)) {
                const activeKits = apiData.kits.filter(kit => 
                    kit && kit.vehicle_id == baseData.id && kit.active === 'TRUE'
                );
                
                if (activeKits.length > 0) {
                    activeKits.forEach(kit => {
                        // Características del kit
                        let features = [];
                        if (Array.isArray(apiData.kitFeatures)) {
                            features = apiData.kitFeatures
                                .filter(feature => feature && feature.kit_id === kit.kit_id)
                                .map(feature => feature.feature_text)
                                .filter(text => text && text.trim() !== '');
                        }
                        
                        // Si no hay características, usar algunas por defecto
                        if (features.length === 0) {
                            features = [
                                'Instalación profesional incluida',
                                'Garantía de 6 meses',
                                'Accesorios originales USA'
                            ];
                        }
                        
                        baseData.kits.push({
                            id: safeGet(kit, 'kit_id', 'basic'),
                            name: safeGet(kit, 'name', 'Básico'),
                            level: safeGet(kit, 'level', 'basic').toLowerCase(),
                            price: safeParseInt(kit.price_clp, 0),
                            description: safeGet(kit, 'description', 'Equipamiento básico'),
                            features: features,
                            image: safeGet(kit, 'image', baseData.baseImage)
                        });
                    });
                }
            }
            
            // Si no hay kits, crear uno básico
            if (baseData.kits.length === 0) {
                baseData.kits.push({
                    id: 'basic',
                    name: 'Básico',
                    level: 'basic',
                    price: 0,
                    description: 'Equipamiento de fábrica',
                    features: ['Versión original', 'Garantía de fábrica', 'Mantenimiento básico'],
                    image: baseData.baseImage
                });
            }
            
            // Ordenar kits por precio
            baseData.kits.sort((a, b) => a.price - b.price);
            
            return baseData;
        });
    } else {
        console.log('⚠️ No se encontraron vehículos en la base de datos');
        loadEmptyData();
        return;
    }
    
    // Actualizar la interfaz con los datos cargados
    updateImportedCounter();
    updateWhatsappLinks();
}

// Cargar datos vacíos como fallback seguro
function loadEmptyData() {
    vehicles = [];
    console.log('ℹ️ Modo datos mínimos activado');
    
    // Mostrar mensaje amigable en la interfaz
    setTimeout(() => {
        const container = document.getElementById('vehiclesContainer');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px; background: var(--gray-50); border-radius: var(--radius); grid-column: 1 / -1;">
                    <div style="font-size: 48px; margin-bottom: 20px;">🚗</div>
                    <h3 style="font-size: 21px; font-weight: 600; margin-bottom: 12px;">Base de datos en mantenimiento</h3>
                    <p style="color: #86868b; max-width: 400px; margin: 0 auto;">
                        Estamos actualizando nuestro inventario. Pronto tendremos nuevos vehículos disponibles.
                    </p>
                    <button class="button" onclick="contactVehicle(0)" style="margin-top: 24px;">
                        <i class="fab fa-whatsapp"></i> Consultar disponibilidad
                    </button>
                </div>
            `;
        }
    }, 100);
}

// Actualizar contador en la interfaz
function updateImportedCounter() {
    const counterElement = document.getElementById('importedVehiclesCounter');
    if (counterElement) {
        counterElement.textContent = importedVehiclesCounter;
    }
}

// Actualizar enlaces de WhatsApp
function updateWhatsappLinks() {
    document.querySelectorAll('a[href*="wa.me"], button[onclick*="wa.me"]').forEach(element => {
        // Actualizar href en enlaces
        if (element.tagName === 'A' && element.href.includes('wa.me')) {
            element.href = `https://wa.me/${whatsappNumber}`;
        }
        
        // Actualizar onclick en botones
        if (element.onclick && element.onclick.toString().includes('wa.me')) {
            const originalOnclick = element.onclick.toString();
            element.setAttribute('onclick', originalOnclick.replace(/wa\.me\/\d+/, `wa.me/${whatsappNumber}`));
        }
    });
}

// Función para formatear precio
window.formatPrice = function(price) {
    if (!price && price !== 0) return '$0';
    return '$' + price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

// Función para obtener vehículos
window.getVehicles = function() {
    return vehicles;
};

// Función para obtener un vehículo por ID
window.getVehicleById = function(id) {
    return vehicles.find(v => v.id === id);
};

// Función para contactar
window.contactVehicle = function(vehicleId) {
    let vehicle;
    let message;
    
    if (vehicleId === 0 || !vehicleId) {
        // Contacto general
        message = `Hola, estoy interesado en importar un vehículo desde USA. ¿Podrían contactarme para asesorarme?`;
    } else {
        vehicle = getVehicleById(vehicleId);
        if (!vehicle) {
            message = `Hola, tengo interés en sus vehículos americanos. ¿Podrían contactarme?`;
        } else {
            message = `Hola, estoy interesado en el vehículo: ${vehicle.name} ($${formatPrice(vehicle.price).replace('$', '')} CLP). Estado: ${vehicle.status === 'stock' ? 'En Stock Arica' : 'En Tránsito'}. ¿Podrían darme más información?`;
        }
    }
    
    trackEvent('contact', 'WhatsApp', vehicle ? vehicle.name : 'General');
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
};

// Inicializar datos cuando se carga la página
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Inicializando aplicación...');
    
    // Cargar desde API
    await loadDataFromAPI();
    
    // Notificar que los datos están listos
    const event = new CustomEvent('dataLoaded', { 
        detail: { 
            vehicles: vehicles,
            count: vehicles.length,
            timestamp: new Date().toISOString()
        } 
    });
    document.dispatchEvent(event);
    
    console.log('✅ Aplicación lista. Vehículos activos:', vehicles.length);
});
