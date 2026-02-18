/* ========================================
   main.js - Inicialización de la Aplicación
   Import American Cars
   ======================================== */

/**
 * Inicializar aplicación cuando el DOM esté listo
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚗 Import American Cars - Initializing...');

    try {
        // 1. Inicializar sistema de consultas (crea modales)
        await consultationSystem.init();
        console.log('✅ Consultation system ready');

        // 2. Inicializar sistema de personalización
        customizationSystem.init();
        console.log('✅ Customization system ready');

        // 3. Inicializar vehículos y filtros
        await vehicleManager.init();
        console.log('✅ Vehicles loaded');

        // 4. Inicializar testimonios y métricas
        await testimonialsSystem.init();
        console.log('✅ Testimonials loaded');

        // 5. Inicializar sistema de actividad
        await activitySystem.init();
        console.log('✅ Activity system ready');

        // 6. Setup eventos globales
        setupGlobalEvents();
        console.log('✅ Global events ready');

        console.log('🎉 Import American Cars - Ready!');

    } catch (error) {
        console.error('❌ Error initializing app:', error);
    }
});

/**
 * Configurar eventos globales
 */
function setupGlobalEvents() {
    // Smooth scroll para enlaces internos
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Header CTA
    const headerCta = document.querySelector('.header-cta');
    if (headerCta) {
        headerCta.addEventListener('click', () => {
            consultationSystem.openWhatsApp();
        });
    }

    // Final CTA
    const finalCta = document.querySelector('.final-cta-btn');
    if (finalCta) {
        finalCta.addEventListener('click', (e) => {
            e.preventDefault();
            consultationSystem.openWhatsApp();
        });
    }

    // Observar scroll para animaciones
    setupScrollObserver();

    // Lazy loading de imágenes
    setupLazyLoading();
}

/**
 * Observer para animaciones en scroll
 */
function setupScrollObserver() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observar elementos animables
    document.querySelectorAll('.delivery-card, .counter-item').forEach(el => {
        el.classList.add('animate-on-scroll');
        observer.observe(el);
    });
}

/**
 * Lazy loading para imágenes
 */
function setupLazyLoading() {
    if ('loading' in HTMLImageElement.prototype) {
        // El navegador soporta lazy loading nativo
        document.querySelectorAll('img[loading="lazy"]').forEach(img => {
            img.src = img.dataset.src || img.src;
        });
    } else {
        // Fallback con Intersection Observer
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    imageObserver.unobserve(img);
                }
            });
        });

        document.querySelectorAll('img[loading="lazy"]').forEach(img => {
            imageObserver.observe(img);
        });
    }
}

/**
 * Utilidad: Abrir WhatsApp con mensaje
 */
function openWhatsApp(message) {
    const number = APP_CONFIG.whatsapp.number;
    const url = `https://wa.me/${number}?text=${encodeURIComponent(message || APP_CONFIG.whatsapp.defaultMessage)}`;
    window.open(url, '_blank');
}

/**
 * Utilidad: Track evento en Analytics
 */
function trackEvent(eventName, category, label) {
    if (typeof gtag !== 'undefined' && APP_CONFIG.analytics.enabled) {
        gtag('event', eventName, {
            'event_category': category,
            'event_label': label
        });
    }
}

/**
 * Cleanup al salir
 */
window.addEventListener('beforeunload', () => {
    activitySystem.destroy();
});

/* ========================================
   ESTILOS ADICIONALES PARA ANIMACIONES
   ======================================== */

const animationStyles = document.createElement('style');
animationStyles.textContent = `
    .animate-on-scroll {
        opacity: 0;
        transform: translateY(30px);
        transition: opacity 0.6s ease, transform 0.6s ease;
    }
    
    .animate-on-scroll.visible {
        opacity: 1;
        transform: translateY(0);
    }
    
    .delivery-card.animate-on-scroll:nth-child(2) {
        transition-delay: 0.1s;
    }
    
    .delivery-card.animate-on-scroll:nth-child(3) {
        transition-delay: 0.2s;
    }
    
    .counter-item.animate-on-scroll:nth-child(2) {
        transition-delay: 0.1s;
    }
    
    .counter-item.animate-on-scroll:nth-child(3) {
        transition-delay: 0.2s;
    }
    
    .counter-item.animate-on-scroll:nth-child(4) {
        transition-delay: 0.3s;
    }
`;
document.head.appendChild(animationStyles);

/* ========================================
   FIN DE MAIN.JS
   ======================================== */
