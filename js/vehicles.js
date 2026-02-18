/* ========================================
   vehicles.js - Gestión de Vehículos
   Import American Cars
   ======================================== */

class VehicleManager {
    constructor() {
        this.vehicles = [];
        this.testimonials = [];
        this.isLoading = false;
    }

    /**
     * Inicializar
     */
    async init() {
        this.showLoading();
        
        try {
            // Cargar vehículos y testimonios en paralelo
            const [vehicles, testimonials] = await Promise.all([
                vehicleAPI.getVehicles(),
                vehicleAPI.getTestimonials()
            ]);
            
            this.vehicles = vehicles;
            this.testimonials = testimonials;
            
            // Inicializar sistema de filtros
            filterSystem.init(this.vehicles, (filtered) => {
                this.renderVehicles(filtered);
            });
            
            // Renderizar vehículos
            this.renderVehicles(this.vehicles);
            
            // Actualizar contador en hero
            this.updateHeroCount();
            
        } catch (error) {
            console.error('Error initializing vehicles:', error);
            this.showError();
        }
    }

    /**
     * Renderizar grid de vehículos
     */
    renderVehicles(vehicles) {
        const container = document.getElementById('vehiclesGrid');
        if (!container) return;

        if (vehicles.length === 0) {
            container.innerHTML = this.renderEmptyState();
            return;
        }

        const html = vehicles.map(vehicle => this.renderVehicleCard(vehicle)).join('');
        container.innerHTML = html;
        
        // Animar entrada
        this.animateCards();
    }

    /**
     * Renderizar tarjeta de vehículo
     */
    renderVehicleCard(vehicle) {
        const statusConfig = APP_CONFIG.vehicleStatus[vehicle.status] || APP_CONFIG.vehicleStatus.stock;
        const testimonial = this.getTestimonialForVehicle(vehicle);
        const scarcityText = this.getScarcityText(vehicle);
        
        return `
            <article class="vehicle-card" data-id="${vehicle.id}" data-type="${vehicle.type}" data-status="${vehicle.status}">
                <div class="vehicle-image-container">
                    <img src="${vehicle.mainImage}" 
                         alt="${vehicle.name}" 
                         class="vehicle-image"
                         loading="lazy"
                         onerror="this.src='https://via.placeholder.com/600x400?text=Sin+Imagen'">
                    
                    <!-- Badge de escasez -->
                    <div class="scarcity-badge">
                        ${scarcityText}
                    </div>
                    
                    <!-- Status tag -->
                    <div class="status-tag status-tag-${vehicle.status}">
                        ${statusConfig.label}
                    </div>
                    
                    <!-- Botón compartir -->
                    <button class="share-btn" onclick="event.stopPropagation(); shareSystem.share('${vehicle.id}')" title="Compartir">
                        <i class="fas fa-share-alt"></i>
                        <span>Compartir</span>
                        ${vehicle.shareCount > 0 ? `<span class="share-count">${vehicle.shareCount}</span>` : ''}
                    </button>
                </div>
                
                <div class="vehicle-body">
                    <h3 class="vehicle-name">${vehicle.name}</h3>
                    <p class="vehicle-specs">${vehicle.specs || this.generateSpecs(vehicle)}</p>
                    
                    <div class="vehicle-price-row">
                        <div class="vehicle-price">${APP_CONFIG.format.currency(vehicle.price)}</div>
                        <span class="vehicle-price-note">
                            ${vehicle.status === 'transit' && vehicle.arrivalDate 
                                ? `Llega ${this.getDaysUntil(vehicle.arrivalDate)} días` 
                                : 'Precio final'}
                        </span>
                    </div>
                    
                    ${testimonial ? this.renderTestimonial(testimonial) : ''}
                    
                    <button class="vehicle-cta" onclick="vehicleManager.openVehicleDetail('${vehicle.id}')">
                        Conocer precio final
                        <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </article>
        `;
    }

    /**
     * Renderizar testimonio en tarjeta
     */
    renderTestimonial(testimonial) {
        return `
            <div class="card-testimonial">
                <img src="${testimonial.author_avatar || 'https://via.placeholder.com/36'}" 
                     alt="${testimonial.author_name}" 
                     class="testimonial-avatar">
                <div class="testimonial-content">
                    <p class="testimonial-quote">"${testimonial.quote}"</p>
                    <p class="testimonial-author">
                        <strong>${testimonial.author_name}</strong> · 
                        ${testimonial.vehicle_purchased ? `Compró un ${testimonial.vehicle_purchased}` : ''}
                        ${testimonial.purchase_date ? ` · ${APP_CONFIG.format.shortDate(testimonial.purchase_date)}` : ''}
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Obtener testimonio relevante para el vehículo
     */
    getTestimonialForVehicle(vehicle) {
        // Buscar testimonio del mismo tipo
        const sameType = this.testimonials.find(t => t.vehicle_type === vehicle.type);
        if (sameType) return sameType;
        
        // Si no hay del mismo tipo, devolver uno aleatorio
        if (this.testimonials.length > 0) {
            const randomIndex = Math.floor(Math.random() * this.testimonials.length);
            return this.testimonials[randomIndex];
        }
        
        return null;
    }

    /**
     * Generar texto de escasez
     */
    getScarcityText(vehicle) {
        const viewCount = vehicle.viewCount || 0;
        
        if (viewCount > 10) {
            return `${Math.min(viewCount, 15)} personas viendo`;
        } else if (viewCount > 5) {
            return `${viewCount} personas viendo`;
        } else if (vehicle.status === 'stock') {
            // Simular actividad para vehículos en stock
            const simulated = Math.floor(Math.random() * 5) + 2;
            return `${simulated} personas viendo`;
        } else {
            return 'Último disponible';
        }
    }

    /**
     * Generar specs si no existen
     */
    generateSpecs(vehicle) {
        // Extraer información del nombre si es posible
        const name = vehicle.name.toLowerCase();
        let specs = [];
        
        if (name.includes('v8')) specs.push('V8');
        else if (name.includes('v6')) specs.push('V6');
        else if (name.includes('hemi')) specs.push('HEMI V8');
        
        specs.push(`${vehicle.year}`);
        specs.push('Automático');
        
        return specs.join(' · ');
    }

    /**
     * Calcular días hasta llegada
     */
    getDaysUntil(dateString) {
        const arrival = new Date(dateString);
        const now = new Date();
        const diff = Math.ceil((arrival - now) / (1000 * 60 * 60 * 24));
        return Math.max(diff, 1);
    }

    /**
     * Abrir detalle del vehículo (modal de precio)
     */
    async openVehicleDetail(vehicleId) {
        const vehicle = this.vehicles.find(v => v.id === vehicleId);
        if (!vehicle) return;

        // Registrar vista
        vehicleAPI.incrementViewCount(vehicleId);
        
        // Track en analytics
        this.trackEvent('view_vehicle', vehicle.name);

        // Abrir modal de consulta
        consultationSystem.open(vehicle);
    }

    /**
     * Actualizar contador en hero
     */
    updateHeroCount() {
        const countEl = document.querySelector('.hero-cta .badge');
        if (countEl) {
            countEl.textContent = this.vehicles.length;
        }
    }

    /**
     * Renderizar estado vacío
     */
    renderEmptyState() {
        return `
            <div class="empty-state">
                <i class="fas fa-car"></i>
                <h3>No hay vehículos disponibles</h3>
                <p>No encontramos vehículos con los filtros seleccionados.</p>
                <button class="button button-outline" onclick="filterSystem.clearFilters()">
                    Limpiar filtros
                </button>
            </div>
        `;
    }

    /**
     * Mostrar loading
     */
    showLoading() {
        const container = document.getElementById('vehiclesGrid');
        if (!container) return;

        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>${APP_CONFIG.messages.loading}</p>
            </div>
        `;
        this.isLoading = true;
    }

    /**
     * Mostrar error
     */
    showError() {
        const container = document.getElementById('vehiclesGrid');
        if (!container) return;

        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error al cargar</h3>
                <p>${APP_CONFIG.messages.error}</p>
                <button class="button" onclick="vehicleManager.init()">
                    Reintentar
                </button>
            </div>
        `;
        this.isLoading = false;
    }

    /**
     * Animar entrada de tarjetas
     */
    animateCards() {
        const cards = document.querySelectorAll('.vehicle-card');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                card.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }

    /**
     * Track evento en Analytics
     */
    trackEvent(eventName, label) {
        if (typeof gtag !== 'undefined' && APP_CONFIG.analytics.enabled) {
            gtag('event', eventName, {
                'event_category': 'Vehicles',
                'event_label': label
            });
        }
    }

    /**
     * Obtener vehículo por ID
     */
    getVehicleById(id) {
        return this.vehicles.find(v => v.id === id);
    }
}

// Crear instancia global
const vehicleManager = new VehicleManager();
window.vehicleManager = vehicleManager;

/* ========================================
   FIN DE VEHICLES.JS
   ======================================== */
