/* ========================================
   config.js - Configuración Central
   Import American Cars
   VERSIÓN FUSIONADA: Combina arquitectura simple
   con todas las funciones nuevas

   IMPORTANTE: el sitio no tiene build step, así que los navegadores
   cachean este archivo agresivamente. Cada vez que se edite, subir
   también el número en "?v=" del <script src="js/config.js?v=...">
   en TODOS los HTML que lo cargan — si no, algunos visitantes van a
   seguir ejecutando la versión vieja hasta que limpien caché a mano.

   Ese "?v=" arregla la caché en la PRÓXIMA visita, pero un celular con
   la pestaña ya abierta en segundo plano (muy común en mobile) se
   queda corriendo el JS viejo indefinidamente hasta que la cierre y
   reabra a mano — no hay Service Worker en este sitio que le avise.
   SITE_VERSION + chequearActualizacionDisponible() (al final de este
   archivo) resuelven eso: comparan la versión corriendo contra la del
   servidor cuando la pestaña vuelve a foco, y muestran un aviso para
   actualizar con un toque en vez de dejarlo a criterio del usuario.
   Subir también SITE_VERSION cada vez que se edite este archivo.
   ======================================== */

const SITE_VERSION = '20260823a';

// ====================================
// SUPABASE
// ====================================
const SUPABASE_CONFIG = {
    url: 'https://cflpmluvhfldewiitymh.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbHBtbHV2aGZsZGV3aWl0eW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MTM0NzcsImV4cCI6MjA4MDk4OTQ3N30.of3ic6N1Y3U5dtSmzKzkTdvfvRnqYjqFI2fglmibaiM'
};

// ====================================
// MERCADO PAGO (Payment Brick) — reemplaza a Flow.cl
// La Public Key NO es secreta (va embebida en el navegador, igual que
// el anonKey de arriba) — el Access Token real vive solo como secret
// en Supabase Edge Functions, nunca acá.
// ====================================
const MP_CONFIG = {
    publicKey: 'APP_USR-d43b39cc-5148-4b31-a4cc-18a8eb676d27'
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
    whatsapp: '56953526956',
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

// trackEvent/trackConversion alimentan GA4 y Meta Pixel desde un solo
// lugar — nadie llama a fbq() directo desde el resto del código, así
// que agregar una plataforma nueva (ej. TikTok) es tocar esta única
// función, no cada botón del sitio.
function trackEvent(eventName, eventCategory, eventLabel, value) {
    if (typeof gtag !== 'undefined') {
        const params = {
            category: eventCategory,
            label: eventLabel
        };
        if (value !== undefined) params.value = value;
        gtag('event', eventName, params);
    }
    // Meta no tiene equivalente estándar para la mayoría de estos
    // eventos de engagement (filtros, scroll, redes) — van como
    // evento personalizado, agrupables por category/label en Events
    // Manager.
    if (typeof fbq !== 'undefined') {
        fbq('trackCustom', eventName, { category: eventCategory, label: eventLabel, value });
    }
}

function trackConversion(eventName, vehicleName, vehiclePrice) {
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, {
            category: 'Conversion',
            label: vehicleName,
            value: vehiclePrice ? Math.round(vehiclePrice / 1000) : 0,
            currency: 'CLP'
        });
    }
    // Lead es el evento estándar de Meta para "mostró intención de
    // compra sin pagar online" — encaja con el contacto por WhatsApp
    // del flujo IAC. Va con el valor real en pesos (no /1000 como
    // arriba — ese ajuste es una convención vieja solo de GA4, no
    // tocar los números que ya viene reportando).
    if (typeof fbq !== 'undefined') {
        fbq('track', 'Lead', { value: vehiclePrice || 0, currency: 'CLP', content_name: vehicleName });
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
// ESCAPE HTML (previene XSS al interpolar
// texto de la BD o de formularios en innerHTML)
// ====================================
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
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
window.escapeHtml = escapeHtml;
window.compressImage = compressImage;
window.uploadImageToCloudinary = uploadImageToCloudinary;

// ====================================
// AVISO DE ACTUALIZACIÓN DISPONIBLE
// Sin esto, un celular con la pestaña ya abierta se queda corriendo el
// JS viejo indefinidamente (no hay Service Worker que lo fuerce a
// refrescar). Compara SITE_VERSION contra la versión real del servidor
// (pide config.js con cache:'no-store', nunca confía en la copia
// cacheada) al volver a foco la pestaña, y cada 5 minutos mientras
// sigue abierta. Nunca interrumpe un checkout en curso — solo muestra
// un aviso, el reload lo dispara la persona.
// ====================================
let actualizacionYaAvisada = false;

async function chequearActualizacionDisponible() {
    if (actualizacionYaAvisada) return;
    try {
        const res = await fetch(`js/config.js?check=${Date.now()}`, { cache: 'no-store' });
        const texto = await res.text();
        const match = texto.match(/const SITE_VERSION = '([^']+)'/);
        if (match && match[1] !== SITE_VERSION) {
            mostrarAvisoActualizacion();
        }
    } catch (e) {
        // Sin conexión momentánea u otro error de red — no molestar por esto.
    }
}

function mostrarAvisoActualizacion() {
    if (actualizacionYaAvisada || document.getElementById('siteUpdateBanner')) return;
    actualizacionYaAvisada = true;

    const banner = document.createElement('div');
    banner.id = 'siteUpdateBanner';
    banner.innerHTML = `
        <span>Hay una versión nueva del sitio disponible.</span>
        <button type="button" id="siteUpdateBannerBtn">Actualizar ahora</button>
    `;
    Object.assign(banner.style, {
        position: 'fixed', left: '0', right: '0', bottom: '0', zIndex: '99999',
        background: '#9B0000', color: '#fff', padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px',
        fontSize: '13.5px', fontWeight: '500', flexWrap: 'wrap', textAlign: 'center',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.3)'
    });
    const btn = banner.querySelector('#siteUpdateBannerBtn');
    Object.assign(btn.style, {
        background: '#fff', color: '#9B0000', border: 'none', borderRadius: '8px',
        padding: '6px 14px', fontWeight: '700', cursor: 'pointer', fontSize: '13px'
    });
    btn.addEventListener('click', () => location.reload());
    document.body.appendChild(banner);
}

function iniciarChequeoActualizaciones() {
    // No interrumpir un checkout en curso — se vuelve a intentar en el
    // próximo chequeo (visibilitychange o el intervalo de 5 min).
    const checkoutEnCurso = () => document.getElementById('checkoutOverlay')?.classList.contains('show');

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !checkoutEnCurso()) chequearActualizacionDisponible();
    });
    setInterval(() => {
        if (!checkoutEnCurso()) chequearActualizacionDisponible();
    }, 5 * 60 * 1000);
}
iniciarChequeoActualizaciones();

console.log('✅ Configuración cargada');
