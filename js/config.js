/* ========================================
   config.js - Configuración Central
   Import American Cars
   ======================================== */

// ====================================
// SUPABASE - Base de Datos
// ====================================
const SUPABASE_CONFIG = {
    url: 'https://cflpmluvhfldewiitymh.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNmbHBtbHV2aGZsZGV3aWl0eW1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MTM0NzcsImV4cCI6MjA4MDk4OTQ3N30.of3ic6N1Y3U5dtSmzKzkTdvfvRnqYjqFI2fglmibaiM'
};

// ====================================
// CLOUDINARY - Imágenes
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
    whatsapp: '56938654827',
    email: 'contacto@importamericancars.cl',
    instagram: 'importamericancars'
};

// ====================================
// GOOGLE ANALYTICS (Opcional)
// ====================================
const GA_MEASUREMENT_ID = 'GA_MEASUREMENT_ID';

// ====================================
// CONFIGURACIÓN DE LA APP
// ====================================
const APP_CONFIG = {
    name: 'Import American Cars',
    currency: 'CLP',
    location: 'Arica, Chile',
    
    maxImageSize: 10 * 1024 * 1024,
    maxImagesPerVehicle: 10,
    imageQuality: 0.85,
    imageMaxWidth: 1200,
    
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
    
    kitLevels: {
        basic: { label: 'Básico', color: '#000000' },
        sport: { label: 'Sport', color: '#ff9500' },
        offroad: { label: 'Off-Road', color: '#00a651' },
        premium: { label: 'Premium', color: '#0066cc' },
        extreme: { label: 'Extreme', color: '#ff3b30' }
    },
    
    importedVehiclesCount: 142
};

// ====================================
// CLIENTE SUPABASE
// ====================================
let supabaseClient = null;

function initSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('❌ Supabase no está cargado');
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
        console.error('❌ Error:', error);
        return null;
    }
}

// ====================================
// UTILIDADES
// ====================================

function formatPrice(price) {
    if (!price) return '0';
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('es-CL', options);
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function isValidImageUrl(url) {
    return /\.(jpg|jpeg|png|webp|gif)$/i.test(url);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    Object.assign(notification.style, {
        position: 'fixed',
        top: '80px',
        right: '20px',
        background: type === 'success' ? 'var(--green)' : 'var(--red)',
        color: 'white',
        padding: '16px 24px',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: '5000',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        animation: 'slideIn 0.3s ease-out',
        maxWidth: '400px'
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

async function compressImage(file, maxWidth = 1200, quality = 0.85) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const img = new Image();
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Error al comprimir imagen'));
                            return;
                        }
                        resolve(new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        }));
                    },
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
        const compressedFile = await compressImage(
            file,
            APP_CONFIG.imageMaxWidth,
            APP_CONFIG.imageQuality
        );
        
        const formData = new FormData();
        formData.append('file', compressedFile);
        formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
        formData.append('cloud_name', CLOUDINARY_CONFIG.cloudName);
        
        if (CLOUDINARY_CONFIG.folder) {
            formData.append('folder', CLOUDINARY_CONFIG.folder);
        }
        
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
            {
                method: 'POST',
                body: formData
            }
        );
        
        if (!response.ok) {
            throw new Error('Error al subir imagen');
        }
        
        const data = await response.json();
        return data.secure_url;
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
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
function trackEvent(eventName, eventCategory, eventLabel) {
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, {
            event_category: eventCategory,
            event_label: eventLabel
        });
    }
}

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return Object.fromEntries(params.entries());
}

function scrollToElement(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function isValidPhone(phone) {
    const re = /^(\+?56)?([2-9]\d{8})$/;
    return re.test(phone.replace(/\s/g, ''));
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showNotification('Copiado al portapapeles', 'success');
    } catch (error) {
        console.error('Error:', error);
        showError('No se pudo copiar');
    }
}

function isMobile() {
    return window.innerWidth <= 768;
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// ====================================
// EXPORTAR A WINDOW
// ====================================
window.APP_CONFIG = APP_CONFIG;
window.CONTACT_CONFIG = CONTACT_CONFIG;
window.initSupabase = initSupabase;
window.formatPrice = formatPrice;
window.formatDate = formatDate;
window.generateId = generateId;
window.isValidImageUrl = isValidImageUrl;
window.debounce = debounce;
window.showNotification = showNotification;
window.showError = showError;
window.compressImage = compressImage;
window.uploadImageToCloudinary = uploadImageToCloudinary;
window.trackEvent = trackEvent;
window.getUrlParams = getUrlParams;
window.scrollToElement = scrollToElement;
window.isValidEmail = isValidEmail;
window.isValidPhone = isValidPhone;
window.copyToClipboard = copyToClipboard;
window.isMobile = isMobile;
window.throttle = throttle;

console.log('✅ Configuración cargada');
