/* ========================================
   gallery.js - Galería de Imágenes
   Import American Cars
   ======================================== */

class GallerySystem {
    constructor() {
        this.currentImages = [];
        this.currentIndex = 0;
        this.isOpen = false;
    }

    /**
     * Abrir galería con las imágenes de un vehículo
     */
    open(vehicleId, startIndex = 0) {
        const vehicle = vehicleManager.getVehicleById(vehicleId);
        if (!vehicle || !vehicle.images || vehicle.images.length === 0) return;

        this.currentImages = vehicle.images;
        this.currentIndex = startIndex;
        this.isOpen = true;

        this.createModal();
        this.renderSlides();
        this.show();

        // Track en Analytics
        this.trackEvent('gallery_open', vehicle.name);
    }

    /**
     * Crear modal de galería si no existe
     */
    createModal() {
        if (document.getElementById('galleryModal')) return;

        const html = `
            <div class="gallery-modal" id="galleryModal">
                <button class="gallery-close" id="galleryClose" aria-label="Cerrar galería">
                    <i class="fas fa-times"></i>
                </button>
                <div class="gallery-counter" id="galleryCounter">1 / 1</div>
                <div class="gallery-slides" id="gallerySlides"></div>
                <button class="gallery-nav prev" id="galleryPrev" aria-label="Anterior">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <button class="gallery-nav next" id="galleryNext" aria-label="Siguiente">
                    <i class="fas fa-chevron-right"></i>
                </button>
                <div class="gallery-dots" id="galleryDots"></div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
        this.setupEventListeners();
    }

    /**
     * Configurar eventos del modal
     */
    setupEventListeners() {
        document.getElementById('galleryClose')?.addEventListener('click', () => this.close());
        document.getElementById('galleryPrev')?.addEventListener('click', () => this.prev());
        document.getElementById('galleryNext')?.addEventListener('click', () => this.next());

        // Cerrar con click en fondo
        document.getElementById('galleryModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'galleryModal') this.close();
        });

        // Teclado
        document.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;
            if (e.key === 'Escape') this.close();
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'ArrowRight') this.next();
        });

        // Swipe touch
        let touchStartX = 0;
        const modal = document.getElementById('galleryModal');
        modal?.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        });
        modal?.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            const diff = touchStartX - touchEndX;
            if (Math.abs(diff) > 50) {
                diff > 0 ? this.next() : this.prev();
            }
        });
    }

    /**
     * Renderizar slides
     */
    renderSlides() {
        const slidesContainer = document.getElementById('gallerySlides');
        const dotsContainer = document.getElementById('galleryDots');
        if (!slidesContainer || !dotsContainer) return;

        // Slides
        slidesContainer.innerHTML = this.currentImages.map((img, index) => `
            <div class="gallery-slide ${index === this.currentIndex ? 'active' : ''}">
                <img src="${img}" alt="Imagen ${index + 1}" loading="lazy">
            </div>
        `).join('');

        // Dots (solo si hay más de 1 imagen)
        if (this.currentImages.length > 1) {
            dotsContainer.innerHTML = this.currentImages.map((_, index) => `
                <div class="gallery-dot ${index === this.currentIndex ? 'active' : ''}" 
                     onclick="gallerySystem.goTo(${index})">
                </div>
            `).join('');
        } else {
            dotsContainer.innerHTML = '';
        }

        this.updateCounter();
        this.updateNavButtons();
    }

    /**
     * Ir a un slide específico
     */
    goTo(index) {
        if (index < 0 || index >= this.currentImages.length) return;

        const slides = document.querySelectorAll('.gallery-slide');
        const dots = document.querySelectorAll('.gallery-dot');

        slides[this.currentIndex]?.classList.remove('active');
        dots[this.currentIndex]?.classList.remove('active');

        this.currentIndex = index;

        slides[this.currentIndex]?.classList.add('active');
        dots[this.currentIndex]?.classList.add('active');

        this.updateCounter();
        this.updateNavButtons();
    }

    /**
     * Imagen anterior
     */
    prev() {
        if (this.currentIndex > 0) {
            this.goTo(this.currentIndex - 1);
        }
    }

    /**
     * Imagen siguiente
     */
    next() {
        if (this.currentIndex < this.currentImages.length - 1) {
            this.goTo(this.currentIndex + 1);
        }
    }

    /**
     * Actualizar contador
     */
    updateCounter() {
        const counter = document.getElementById('galleryCounter');
        if (counter) {
            counter.textContent = `${this.currentIndex + 1} / ${this.currentImages.length}`;
        }
    }

    /**
     * Actualizar visibilidad de botones de navegación
     */
    updateNavButtons() {
        const prevBtn = document.getElementById('galleryPrev');
        const nextBtn = document.getElementById('galleryNext');

        if (prevBtn) prevBtn.style.opacity = this.currentIndex === 0 ? '0.3' : '1';
        if (nextBtn) nextBtn.style.opacity = this.currentIndex === this.currentImages.length - 1 ? '0.3' : '1';
    }

    /**
     * Mostrar galería
     */
    show() {
        const modal = document.getElementById('galleryModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Cerrar galería
     */
    close() {
        const modal = document.getElementById('galleryModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        this.isOpen = false;
    }

    /**
     * Track evento
     */
    trackEvent(eventName, label) {
        if (typeof gtag !== 'undefined' && APP_CONFIG.analytics.enabled) {
            gtag('event', eventName, {
                'event_category': 'Gallery',
                'event_label': label
            });
        }
    }
}

// Crear instancia global
const gallerySystem = new GallerySystem();
window.gallerySystem = gallerySystem;

/* ========================================
   FIN DE GALLERY.JS
   ======================================== */
