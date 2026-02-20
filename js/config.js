/* ========================================
   config.js - Configuración Central
   Import American Cars
   VERSIÓN FUSIONADA: Combina arquitectura simple
   con todas las funciones nuevas
   ======================================== */

// ====================================
// SUPABASE
// ====================================
const SUPABASE_CONFIG = {
    url: 'https://cflpmluvhfldewiitymh.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbHBtbHV2aGZsZGV3aWl0eW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MTM0NzcsImV4cCI6MjA4MDk4OTQ3N30.of3ic6N1Y3U5dtSmzKzkTdvfvRnqYjqFI2fglmibaiM'
};

// ====================================
// CLOUDINARY
// ====================================
const CLOUDINARY_CONFIG = {
    cloudName: 'df2gprqhp',
    uploadPreset: 'vehicles_preset',
    folder: 'vehicles'
};

// ====================================
// CONTACTO
// ====================================
const CONTACT_CONFIG = {
    whatsapp: '56981458545',
    email: 'contacto@importamericancars.cl',
    instagram: 'importamericancars'
};

// ====================================
// CONFIGURACIÓN GENERAL DE LA APP
// ====================================
const APP_CONFIG = {
    name: 'Import American Cars',
    currency: 'CLP',
    location: 'Arica, Chile',

    // Imágenes
    maxImageSize: 10 * 1024 * 1024,
    maxImagesPerVehicle: 10,
    imageQuality: 0.85,
    imageMaxWidth: 1200,

    // Contadores hero
    importedVehiclesCount: 142,

    // Estados de vehículos
    vehicleStatuses: {
        stock: {
            label: 'En Stock Arica',
            color: '#00a651',
            badge: 'status-badge-stock'
        },
        transit: {
            label: 'En Tránsito',
            color: '#0066cc',
            badge: 'status-badge-transit'
        },
        reserve: {
            label: 'Para Reservar',
            color: '#ff9500',
            badge: 'status-badge-reserve'
        }
    },

    // Tipos de vehículos (para filtro doble tipo + estado)
    vehicleTypes: {
        all:     { label: 'Todos',    icon: 'fa-th' },
        pickup:  { label: 'Pickup',   icon: 'fa-truck-pickup' },
        suv:     { label: 'SUV',      icon: 'fa-car-side' },
        muscle:  { label: 'Muscle',   icon: 'fa-bolt' },
        offroad: { label: 'Off-Road', icon: 'fa-mountain' }
    },

    // Niveles de kits de personalización
    kitLevels: {
        basic:   { label: 'Básico',   color: '#000000' },
        sport:   { label: 'Sport',    color: '#ff9500' },
        offroad: { label: 'Off-Road', color: '#00a651' },
        premium: { label: 'Premium',  color: '#0066cc' },
        extreme: { label: 'Extreme',  color: '#ff3b30' }
    }
};

// ====================================
// INICIALIZAR SUPABASE
// ====================================
let supabaseClient = null;

function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase SDK no cargado');
        return null;
    }
    try {
        supabaseClient = supabase.createClient(
            SUPABASE_CONFIG.url,
            SUPABASE_CONFIG.anonKey
        );
        console.log('✅ Supabase inicializado');
        return supabaseClient;
    } catch (error) {
        console.error('❌ Error iniciando Supabase:', error);
        return null;
    }
}

// ====================================
// UTILIDADES GLOBALES
// ====================================

function formatPrice(price) {
    if (!price) return '0';
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('es-CL', {
        year: 'numeric', month: 'long', day: 'numeric'
    });
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

function isMobile() {
    return window.innerWidth <= 768;
}

function scrollToElement(elementId) {
    const el = document.getElementById(elementId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function trackEvent(eventName, eventCategory, eventLabel) {
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, {
            event_category: eventCategory,
            event_label: eventLabel
        });
    }
}

// ====================================
// NOTIFICACIONES
// ====================================
function showNotification(message, type = 'success') {
    // Eliminar notificación existente si hay
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    Object.assign(notification.style, {
        position: 'fixed',
        top: '80px',
        right: '20px',
        background: type === 'success' ? '#00a651' : type === 'error' ? '#ff3b30' : '#0066cc',
        color: 'white',
        padding: '16px 24px',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: '9999',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        animation: 'slideIn 0.3s ease-out',
        maxWidth: '400px',
        fontSize: '14px',
        fontWeight: '500'
    });
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showError(message) {
    showNotification(message, 'error');
}

// ====================================
// CLOUDINARY - COMPRIMIR Y SUBIR
// ====================================
async function compressImage(file, maxWidth = 1200, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob(
                    (blob) => blob
                        ? resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }))
                        : reject(new Error('Error al comprimir imagen')),
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = () => reject(new Error('Error al cargar imagen'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Error al leer archivo'));
        reader.readAsDataURL(file);
    });
}

async function uploadImageToCloudinary(file) {
    try {
        const compressed = await compressImage(file, APP_CONFIG.imageMaxWidth, APP_CONFIG.imageQuality);
        const formData = new FormData();
        formData.append('file', compressed);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
        if (CLOUDINARY_CONFIG.folder) formData.append('folder', CLOUDINARY_CONFIG.folder);

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
            { method: 'POST', body: formData }
        );
        if (!response.ok) throw new Error('Error al subir imagen');
        const data = await response.json();
        return data.secure_url;
    } catch (error) {
        console.error('Error Cloudinary:', error);
        throw error;
    }
}

// ====================================
// EXPORTAR GLOBALES
// ====================================
window.APP_CONFIG = APP_CONFIG;
window.CONTACT_CONFIG = CONTACT_CONFIG;
window.CLOUDINARY_CONFIG = CLOUDINARY_CONFIG;
window.initSupabase = initSupabase;
window.formatPrice = formatPrice;
window.formatDate = formatDate;
window.debounce = debounce;
window.throttle = throttle;
window.isMobile = isMobile;
window.scrollToElement = scrollToElement;
window.trackEvent = trackEvent;
window.showNotification = showNotification;
window.showError = showError;
window.compressImage = compressImage;
window.uploadImageToCloudinary = uploadImageToCloudinary;

console.log('✅ Configuración cargada');
