/* ========================================
   testimonials.js - Testimonios y Entregas
   Import American Cars
   ======================================== */

class TestimonialsSystem {
    constructor() {
        this.deliveries = [];
        this.trustMetrics = {};
        this.isLoaded = false;
    }

    /**
     * Inicializar sistema
     */
    async init() {
        if (this.isLoaded) return;

        try {
            // Cargar datos en paralelo
            const [deliveries, metrics] = await Promise.all([
                vehicleAPI.getDeliveries(3),
                vehicleAPI.getTrustMetrics()
            ]);

            this.deliveries = deliveries;
            this.trustMetrics = metrics;

            // Renderizar secciones
            this.renderTrustBar();
            this.renderDeliveriesSection();
            this.renderTrustCounter();

            this.isLoaded = true;
        } catch (error) {
            console.error('Error loading testimonials:', error);
        }
    }

    /**
     * Renderizar Trust Bar en el hero
     */
    renderTrustBar() {
        const container = document.getElementById('trustBar');
        if (!container) return;

        const metrics = this.trustMetrics;

        container.innerHTML = `
            <div class="trust-bar-inner">
                <div class="trust-item">
                    <div class="trust-value">${metrics.imported_count || '142'}</div>
                    <div class="trust-label">Importados</div>
                </div>
                <div class="trust-item">
                    <div class="trust-value">${metrics.google_rating || '4.9'}</div>
                    <div class="trust-label">Google Reviews</div>
                </div>
                <div class="trust-item">
                    <div class="trust-value">${metrics.avg_days || '45'}</div>
                    <div class="trust-label">Días promedio</div>
                </div>
                <div class="trust-item">
                    <div class="trust-value">${metrics.satisfaction || '100'}%</div>
                    <div class="trust-label">Satisfacción</div>
                </div>
                <div class="trust-item">
                    <div class="trust-value">${metrics.complaints || '0'}</div>
                    <div class="trust-label">Reclamos</div>
                </div>
            </div>
        `;
    }

    /**
     * Renderizar sección de entregas recientes
     */
    renderDeliveriesSection() {
        const container = document.getElementById('deliveriesGrid');
        if (!container) return;

        if (this.deliveries.length === 0) {
            container.innerHTML = '<p class="text-center text-gray">No hay entregas recientes disponibles.</p>';
            return;
        }

        const html = this.deliveries.map(delivery => this.renderDeliveryCard(delivery)).join('');
        container.innerHTML = html;
    }

    /**
     * Renderizar tarjeta de entrega
     */
    renderDeliveryCard(delivery) {
        return `
            <article class="delivery-card">
                <div class="delivery-image">
                    <img src="${delivery.vehicle_image || 'https://via.placeholder.com/600x280'}" 
                         alt="${delivery.vehicle_name}"
                         loading="lazy">
                    ${delivery.is_verified ? `
                        <div class="verified-badge">
                            <i class="fas fa-check-circle"></i>
                            Compra verificada
                        </div>
                    ` : ''}
                </div>
                <div class="delivery-body">
                    <p class="delivery-vehicle">${delivery.vehicle_name}</p>
                    <p class="delivery-quote">"${delivery.quote}"</p>
                    <div class="delivery-author">
                        <img src="${delivery.client_avatar || 'https://via.placeholder.com/44'}" 
                             alt="${delivery.client_name}" 
                             class="delivery-author-avatar">
                        <div>
                            <p class="delivery-author-name">${delivery.client_name}</p>
                            <p class="delivery-author-meta">
                                ${delivery.client_city || ''} 
                                ${delivery.delivery_date ? '· ' + APP_CONFIG.format.shortDate(delivery.delivery_date) : ''}
                            </p>
                        </div>
                    </div>
                    ${delivery.instagram_url ? `
                        <a href="${delivery.instagram_url}" target="_blank" rel="noopener" class="delivery-social">
                            <i class="fab fa-instagram"></i>
                            Ver entrega en Instagram
                        </a>
                    ` : ''}
                </div>
            </article>
        `;
    }

    /**
     * Renderizar contador de impacto
     */
    renderTrustCounter() {
        const container = document.getElementById('trustCounterGrid');
        if (!container) return;

        const metrics = this.trustMetrics;
        
        // Calcular ahorro total aproximado (ejemplo: 15M por vehículo promedio)
        const totalSaved = (parseInt(metrics.imported_count) || 142) * 15000000;
        const formattedSaved = this.formatLargeNumber(totalSaved);

        container.innerHTML = `
            <div class="counter-item">
                <div class="counter-value">${metrics.imported_count || '142'}</div>
                <div class="counter-label">Vehículos importados</div>
            </div>
            <div class="counter-item">
                <div class="counter-value">${formattedSaved}</div>
                <div class="counter-label">Ahorrados a clientes</div>
            </div>
            <div class="counter-item">
                <div class="counter-value">${metrics.avg_days || '45'}</div>
                <div class="counter-label">Días promedio</div>
            </div>
            <div class="counter-item">
                <div class="counter-value">${metrics.complaints || '0'}</div>
                <div class="counter-label">Reclamos</div>
            </div>
        `;
    }

    /**
     * Formatear número grande
     */
    formatLargeNumber(num) {
        if (num >= 1000000000) {
            return '$' + (num / 1000000000).toFixed(1) + 'B';
        }
        if (num >= 1000000) {
            return '$' + (num / 1000000).toFixed(1) + 'M';
        }
        return APP_CONFIG.format.currency(num);
    }
}

// Crear instancia global
const testimonialsSystem = new TestimonialsSystem();
window.testimonialsSystem = testimonialsSystem;

/* ========================================
   FIN DE TESTIMONIALS.JS
   ======================================== */
