/* ========================================
   share.js - Sistema de Compartir
   Import American Cars
   ======================================== */

class ShareSystem {
    constructor() {
        this.isSharing = false;
    }

    /**
     * Compartir vehículo
     */
    async share(vehicleId) {
        if (this.isSharing) return;
        this.isSharing = true;

        try {
            // Obtener datos del vehículo
            const vehicle = vehicleManager.getVehicleById(vehicleId);
            if (!vehicle) {
                console.error('Vehicle not found:', vehicleId);
                return;
            }

            const shareUrl = this.buildUrl(vehicleId);
            const shareText = this.buildText(vehicle);

            // Intentar Web Share API (móvil principalmente)
            if (navigator.share && this.isMobile()) {
                await this.nativeShare(shareText, shareUrl, vehicle);
            } else {
                // Fallback: copiar al portapapeles
                await this.copyToClipboard(shareUrl, vehicleId);
            }

            // Registrar compartido
            await this.recordShare(vehicleId, vehicle);

        } catch (error) {
            console.error('Error sharing:', error);
            // Fallback a copiar
            await this.copyToClipboard(this.buildUrl(vehicleId), vehicleId);
        } finally {
            this.isSharing = false;
        }
    }

    /**
     * Compartir usando Web Share API
     */
    async nativeShare(text, url, vehicle) {
        try {
            await navigator.share({
                title: vehicle.name,
                text: text,
                url: url
            });
            this.showFeedback('shared');
        } catch (error) {
            // Usuario canceló o error
            if (error.name !== 'AbortError') {
                throw error;
            }
        }
    }

    /**
     * Copiar al portapapeles
     */
    async copyToClipboard(url, vehicleId) {
        try {
            await navigator.clipboard.writeText(url);
            this.showFeedback('copied');
            this.animateButton(vehicleId);
        } catch (error) {
            // Fallback para navegadores antiguos
            this.fallbackCopy(url);
        }
    }

    /**
     * Fallback para copiar
     */
    fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            this.showFeedback('copied');
        } catch (error) {
            console.error('Fallback copy failed:', error);
            this.showFeedback('error');
        }
        
        document.body.removeChild(textarea);
    }

    /**
     * Registrar compartido
     */
    async recordShare(vehicleId, vehicle) {
        // Incrementar contador en BD
        await vehicleAPI.incrementShareCount(vehicleId);

        // Registrar actividad
        await activitySystem.logUserActivity('share', {
            id: vehicleId,
            name: vehicle.name
        });

        // Actualizar contador en UI
        this.updateShareCount(vehicleId);

        // Track en analytics
        this.trackShare(vehicle.name);
    }

    /**
     * Actualizar contador de shares en la UI
     */
    updateShareCount(vehicleId) {
        const card = document.querySelector(`.vehicle-card[data-id="${vehicleId}"]`);
        if (!card) return;

        const shareBtn = card.querySelector('.share-btn');
        if (!shareBtn) return;

        let countEl = shareBtn.querySelector('.share-count');
        
        if (countEl) {
            const currentCount = parseInt(countEl.textContent) || 0;
            countEl.textContent = currentCount + 1;
        } else {
            // Crear elemento de contador
            const span = document.createElement('span');
            span.className = 'share-count';
            span.textContent = '1';
            shareBtn.appendChild(span);
        }
    }

    /**
     * Animar botón de compartir
     */
    animateButton(vehicleId) {
        const card = document.querySelector(`.vehicle-card[data-id="${vehicleId}"]`);
        if (!card) return;

        const shareBtn = card.querySelector('.share-btn');
        if (!shareBtn) return;

        shareBtn.classList.add('shared');
        
        setTimeout(() => {
            shareBtn.classList.remove('shared');
        }, 400);
    }

    /**
     * Mostrar feedback al usuario
     */
    showFeedback(type) {
        const messages = {
            copied: APP_CONFIG.messages.copied,
            shared: APP_CONFIG.messages.shared,
            error: 'No se pudo compartir'
        };

        const message = messages[type] || messages.error;

        // Crear toast temporal
        this.showToast(message);
    }

    /**
     * Mostrar toast
     */
    showToast(message) {
        // Remover toast existente
        const existingToast = document.querySelector('.share-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'share-toast';
        toast.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;

        // Estilos inline para el toast
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%) translateY(20px)',
            background: 'var(--black)',
            color: 'var(--white)',
            padding: '12px 24px',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: 'var(--font-md)',
            fontWeight: 'var(--font-medium)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 'var(--z-notification)',
            opacity: '0',
            transition: 'all 0.3s ease'
        });

        document.body.appendChild(toast);

        // Animar entrada
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });

        // Remover después de 2 segundos
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 2000);
    }

    /**
     * Construir URL para compartir
     */
    buildUrl(vehicleId) {
        return `${APP_CONFIG.share.baseUrl}/vehiculo/${vehicleId}`;
    }

    /**
     * Construir texto para compartir
     */
    buildText(vehicle) {
        return APP_CONFIG.share.buildText(vehicle);
    }

    /**
     * Detectar si es móvil
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    /**
     * Track en Analytics
     */
    trackShare(vehicleName) {
        if (typeof gtag !== 'undefined' && APP_CONFIG.analytics.enabled) {
            gtag('event', 'share', {
                'event_category': 'Engagement',
                'event_label': vehicleName,
                'method': this.isMobile() ? 'native_share' : 'clipboard'
            });
        }
    }

    /**
     * Compartir en plataforma específica
     */
    shareOn(platform, vehicleId) {
        const vehicle = vehicleManager.getVehicleById(vehicleId);
        if (!vehicle) return;

        const platformConfig = APP_CONFIG.share.platforms[platform];
        if (!platformConfig) return;

        const url = this.buildUrl(vehicleId);
        const text = this.buildText(vehicle);
        const shareUrl = platformConfig.buildUrl(text, url);

        window.open(shareUrl, '_blank', 'width=600,height=400');
        
        this.recordShare(vehicleId, vehicle);
    }
}

// Crear instancia global
const shareSystem = new ShareSystem();
window.shareSystem = shareSystem;

/* ========================================
   FIN DE SHARE.JS
   ======================================== */
