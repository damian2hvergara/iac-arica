// Configuración de la aplicación
const CONFIG = {
    // Tu API de Google Apps Script
    API_URL: 'https://script.google.com/macros/s/AKfycbzxFjTR30yKzFEdmEtZGrDLqx21gzMu-zYuZdQ3FLdV9gI5s79C-0LLbrVF71ftUOeq/exec',
    
    // Valores por defecto
    DEFAULT_WHATSAPP: '56938654827',
    DEFAULT_IMPORTED_COUNT: 142,
    
    // Estado global único
    STATE: {
        vehicles: [],
        importedCounter: 142,
        whatsappNumber: '56938654827',
        currentFilter: 'all',
        selectedVehicle: null,
        selectedKit: null,
        currentInstagramGallery: null,
        currentInstagramSlide: 0
    },
    
    // Utilidades
    formatPrice: function(price) {
        if (!price && price !== 0) return '$0';
        return '$' + price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    },
    
    safeParseInt: function(value, fallback = 0) {
        const n = parseInt(value, 10);
        return isNaN(n) ? fallback : n;
    },
    
    safeString: function(value, fallback = '') {
        return value !== undefined && value !== null && value !== '' ? value : fallback;
    }
};

// Hacer disponible globalmente
window.CONFIG = CONFIG;
