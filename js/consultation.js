/* ========================================
   consultation.js - Sistema de Consultas
   Import American Cars
   ======================================== */

class ConsultationSystem {
    constructor() {
        this.currentVehicle = null;
        this.faqs = [];
        this.isInitialized = false;
    }

    /**
     * Inicializar sistema
     */
    async init() {
        if (this.isInitialized) return;
        
        // Cargar FAQs
        this.faqs = await vehicleAPI.getFAQs();
        
        // Crear modales si no existen
        this.createModals();
        
        // Setup event listeners
        this.setupEventListeners();
        
        this.isInitialized = true;
    }

    /**
     * Crear estructura de modales
     */
    createModals() {
        // Verificar si ya existen
        if (document.getElementById('consultOptionsModal')) return;

        const advisor = APP_CONFIG.consultation.advisor;
        
        const modalsHTML = `
            <!-- Modal de Opciones de Consulta -->
            <div class="modal-overlay" id="consultOptionsModal">
                <div class="modal-box consult-modal">
                    <div class="modal-header">
                        <button class="modal-close" onclick="consultationSystem.close('consultOptionsModal')">
                            <i class="fas fa-times"></i>
                        </button>
                        <h3 class="modal-title">¿Primera vez importando?</h3>
                        <p class="modal-subtitle">Elige cómo prefieres resolver tus dudas</p>
                    </div>
                    <div class="consult-options">
                        <div class="consult-card" onclick="consultationSystem.showVideo()">
                            <div class="consult-card-icon">
                                <i class="fas fa-play"></i>
                            </div>
                            <h4>Ver proceso</h4>
                            <p>Video de 2 min</p>
                        </div>
                        <div class="consult-card" onclick="consultationSystem.showFAQs()">
                            <div class="consult-card-icon">
                                <i class="fas fa-list-check"></i>
                            </div>
                            <h4>5 dudas</h4>
                            <p>Preguntas comunes</p>
                        </div>
                        <div class="consult-card primary" onclick="consultationSystem.openWhatsApp()">
                            <div class="consult-card-icon">
                                <i class="fab fa-whatsapp"></i>
                            </div>
                            <h4>Hablar ahora</h4>
                            <p>Respuesta < 5 min</p>
                        </div>
                    </div>
                    <div class="consult-advisor">
                        <img src="${advisor.avatar}" alt="${advisor.name}" class="advisor-avatar">
                        <div>
                            <p class="advisor-name">${advisor.name} te asesora</p>
                            <p class="advisor-status">
                                <span class="status-online"></span>
                                En línea ahora
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Modal de Video -->
            <div class="modal-overlay" id="videoModal">
                <div class="modal-box video-modal">
                    <div class="modal-header">
                        <button class="modal-close" onclick="consultationSystem.close('videoModal')">
                            <i class="fas fa-times"></i>
                        </button>
                        <h3 class="modal-title">Cómo funciona el proceso</h3>
                        <p class="modal-subtitle">En 2 minutos te explicamos todo</p>
                    </div>
                    <div class="video-container">
                        <div class="video-wrapper">
                            <div class="video-placeholder" onclick="consultationSystem.playVideo()">
                                <i class="fas fa-play-circle"></i>
                                <p>Click para reproducir</p>
                            </div>
                        </div>
                    </div>
                    <div class="video-cta">
                        <p>¿Listo para empezar?</p>
                        <button class="button button-pill" onclick="consultationSystem.openWhatsApp()">
                            <i class="fab fa-whatsapp"></i>
                            Hablar con ${advisor.name}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal de FAQs -->
            <div class="modal-overlay" id="faqModal">
                <div class="modal-box faq-modal">
                    <div class="modal-header">
                        <button class="modal-close" onclick="consultationSystem.close('faqModal')">
                            <i class="fas fa-times"></i>
                        </button>
                        <h3 class="modal-title">Las 5 dudas más comunes</h3>
                        <p class="modal-subtitle">Lo que todos quieren saber antes de importar</p>
                    </div>
                    <div class="faq-list" id="faqList">
                        <!-- FAQs se renderizan dinámicamente -->
                    </div>
                    <div class="faq-cta">
                        <p>¿Tienes otra pregunta?</p>
                        <button class="button button-pill" onclick="consultationSystem.openWhatsApp()">
                            <i class="fab fa-whatsapp"></i>
                            Pregúntale a ${advisor.name}
                        </button>
                    </div>
                </div>
            </div>

            <!-- Modal de Precio -->
            <div class="modal-overlay" id="priceModal">
                <div class="modal-box price-modal">
                    <div class="modal-header" id="priceModalHeader">
                        <button class="modal-close" onclick="consultationSystem.close('priceModal')">
                            <i class="fas fa-times"></i>
                        </button>
                        <!-- Contenido dinámico -->
                    </div>
                    <div class="price-body" id="priceModalBody">
                        <!-- Contenido dinámico -->
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalsHTML);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Cerrar modales con click fuera
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAll();
                }
            });
        });

        // Cerrar con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAll();
            }
        });
    }

    /**
     * Abrir consulta para un vehículo
     */
    open(vehicle) {
        this.currentVehicle = vehicle;
        
        // Mostrar directamente el modal de precio con opciones
        this.showPriceModal(vehicle);
    }

    /**
     * Mostrar modal de precio con anclaje
     */
    showPriceModal(vehicle) {
        const headerEl = document.getElementById('priceModalHeader');
        const bodyEl = document.getElementById('priceModalBody');
        
        if (!headerEl || !bodyEl) return;

        const priceAnchor = vehicle.priceAnchor || Math.round(vehicle.price * 1.5);
        const savings = priceAnchor - vehicle.price;
        const advisor = APP_CONFIG.consultation.advisor;

        headerEl.innerHTML = `
            <button class="modal-close" onclick="consultationSystem.close('priceModal')">
                <i class="fas fa-times"></i>
            </button>
            <img src="${vehicle.mainImage}" alt="${vehicle.name}" class="price-vehicle-thumb">
            <div class="price-vehicle-info">
                <h3>${vehicle.name}</h3>
                <p>${vehicle.specs || vehicle.year + ' · Automático'}</p>
            </div>
        `;

        bodyEl.innerHTML = `
            <div class="price-comparison">
                <div class="price-line striked">
                    <span class="price-label">Precio concesionario Chile</span>
                    <span class="price-amount">${APP_CONFIG.format.currency(priceAnchor)}</span>
                </div>
                ${vehicle.priceUsa ? `
                <div class="price-line striked">
                    <span class="price-label">Precio directo USA</span>
                    <span class="price-amount">$${vehicle.priceUsa.toLocaleString()} USD</span>
                </div>
                ` : ''}
                <div class="price-line highlight">
                    <span class="price-label">Tu precio con nosotros</span>
                    <span class="price-amount">${APP_CONFIG.format.currency(vehicle.price)}</span>
                </div>
            </div>
            
            <div class="savings-block">
                <div class="savings-icon">
                    <i class="fas fa-arrow-down"></i>
                </div>
                <div class="savings-text">
                    <strong>Ahorras ${APP_CONFIG.format.currency(savings)}</strong>
                    <span>Equivalente a un auto pequeño completo</span>
                </div>
            </div>
            
            <div class="guarantees-list">
                <div class="guarantee-item">
                    <i class="fas fa-check"></i>
                    <span>Garantía 12 meses incluida</span>
                </div>
                <div class="guarantee-item">
                    <i class="fas fa-check"></i>
                    <span>Nosotros realizamos todos los trámites</span>
                </div>
                <div class="guarantee-item">
                    <i class="fas fa-check"></i>
                    <span>Devolución si no cumple expectativas</span>
                </div>
                <div class="guarantee-item">
                    <i class="fas fa-check"></i>
                    <span>Financiamiento disponible</span>
                </div>
            </div>
            
            <button class="price-cta" onclick="consultationSystem.openWhatsApp()">
                <i class="fab fa-whatsapp"></i>
                Reservar este precio
            </button>
            
            <div style="text-align: center; margin-top: 16px;">
                <button class="button button-ghost button-sm" onclick="consultationSystem.showOptions()">
                    <i class="fas fa-question-circle"></i>
                    ¿Primera vez importando?
                </button>
            </div>
        `;

        this.openModal('priceModal');
        this.trackPath('price_view');
    }

    /**
     * Mostrar opciones de consulta
     */
    showOptions() {
        this.close('priceModal');
        setTimeout(() => {
            this.openModal('consultOptionsModal');
        }, 200);
    }

    /**
     * Mostrar modal de video
     */
    showVideo() {
        this.close('consultOptionsModal');
        setTimeout(() => {
            this.openModal('videoModal');
            this.trackPath('video');
        }, 200);
    }

    /**
     * Reproducir video
     */
    playVideo() {
        const wrapper = document.querySelector('.video-wrapper');
        if (!wrapper) return;

        const videoUrl = APP_CONFIG.consultation.videoUrl;
        
        wrapper.innerHTML = `
            <iframe 
                src="${videoUrl}?autoplay=1" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen>
            </iframe>
        `;
    }

    /**
     * Mostrar FAQs
     */
    showFAQs() {
        this.close('consultOptionsModal');
        setTimeout(() => {
            this.renderFAQs();
            this.openModal('faqModal');
            this.trackPath('faqs');
        }, 200);
    }

    /**
     * Renderizar FAQs
     */
    renderFAQs() {
        const container = document.getElementById('faqList');
        if (!container) return;

        if (this.faqs.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--gray-500);">Cargando preguntas...</p>';
            return;
        }

        const html = this.faqs.map((faq, index) => `
            <div class="faq-item" data-index="${index}">
                <div class="faq-question" onclick="consultationSystem.toggleFAQ(${index})">
                    <span>${faq.question}</span>
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div class="faq-answer">
                    <p>${faq.answer}</p>
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    /**
     * Toggle FAQ
     */
    toggleFAQ(index) {
        const items = document.querySelectorAll('.faq-item');
        
        items.forEach((item, i) => {
            if (i === index) {
                item.classList.toggle('open');
            } else {
                item.classList.remove('open');
            }
        });
    }

    /**
     * Abrir WhatsApp
     */
    openWhatsApp() {
        const number = APP_CONFIG.whatsapp.number;
        let message;
        
        if (this.currentVehicle) {
            message = APP_CONFIG.whatsapp.vehicleMessage(this.currentVehicle);
        } else {
            message = APP_CONFIG.whatsapp.defaultMessage;
        }
        
        const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        
        // Registrar actividad
        if (this.currentVehicle) {
            vehicleAPI.logActivity('inquiry', {
                vehicleId: this.currentVehicle.id,
                vehicleName: this.currentVehicle.name
            });
        }
        
        this.trackPath('whatsapp');
        this.closeAll();
    }

    /**
     * Abrir modal
     */
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Cerrar modal específico
     */
    close(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    /**
     * Cerrar todos los modales
     */
    closeAll() {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.remove('active');
        });
        document.body.style.overflow = '';
    }

    /**
     * Track path en analytics
     */
    trackPath(path) {
        if (typeof gtag !== 'undefined' && APP_CONFIG.analytics.enabled) {
            gtag('event', 'consultation_path', {
                'event_category': 'Consultation',
                'event_label': path,
                'vehicle': this.currentVehicle?.name || 'none'
            });
        }
    }
}

// Crear instancia global
const consultationSystem = new ConsultationSystem();
window.consultationSystem = consultationSystem;

/* ========================================
   FIN DE CONSULTATION.JS
   ======================================== */
