/* ========================================
   customization.js - Sistema de Personalización
   Import American Cars
   ======================================== */

class CustomizationSystem {
    constructor() {
        this.currentVehicle = null;
        this.selectedKits = new Set();
        this.isInitialized = false;
    }

    /**
     * Inicializar sistema
     */
    init() {
        if (this.isInitialized) return;
        this.createModal();
        this.isInitialized = true;
    }

    /**
     * Crear modal de personalización
     */
    createModal() {
        if (document.getElementById('customizationModal')) return;

        const html = `
            <div class="modal-overlay" id="customizationModal">
                <div class="modal-box customization-modal">
                    <div class="modal-header">
                        <button class="modal-close" onclick="customizationSystem.close()">
                            <i class="fas fa-times"></i>
                        </button>
                        <h3 class="modal-title">Personaliza tu vehículo</h3>
                        <p class="modal-subtitle">Agrega accesorios premium antes de la importación</p>
                    </div>
                    <div class="customization-body" id="customizationBody">
                        <!-- Contenido dinámico -->
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);

        // Cerrar con click fuera
        document.getElementById('customizationModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'customizationModal') this.close();
        });

        // Cerrar con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.close();
        });
    }

    /**
     * Abrir modal de personalización
     */
    open(vehicleId) {
        const vehicle = vehicleManager.getVehicleById(vehicleId);
        if (!vehicle) return;

        this.currentVehicle = vehicle;
        this.selectedKits.clear();

        this.renderContent();

        const modal = document.getElementById('customizationModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }

        this.trackEvent('customize_open', vehicle.name);
    }

    /**
     * Renderizar contenido del modal
     */
    renderContent() {
        const body = document.getElementById('customizationBody');
        if (!body || !this.currentVehicle) return;

        const kits = APP_CONFIG.customizationKits;

        body.innerHTML = `
            <div class="customization-vehicle">
                <img src="${this.currentVehicle.mainImage}" alt="${this.currentVehicle.name}">
                <div class="customization-vehicle-info">
                    <h4>${this.currentVehicle.name}</h4>
                    <p>Precio base: <strong>${APP_CONFIG.format.currency(this.currentVehicle.price)}</strong></p>
                </div>
            </div>

            <div class="customization-kits" id="customizationKits">
                ${Object.values(kits).map(kit => this.renderKitCard(kit)).join('')}
            </div>

            <div class="customization-summary" id="customizationSummary">
                <div class="summary-total">
                    <span>Total con kits:</span>
                    <strong id="customizationTotal">${APP_CONFIG.format.currency(this.currentVehicle.price)}</strong>
                </div>
                <button class="price-cta" onclick="customizationSystem.sendToWhatsApp()">
                    <i class="fab fa-whatsapp"></i>
                    Cotizar con personalización
                </button>
                <button class="button button-ghost button-sm" style="width:100%; margin-top: 10px;" onclick="customizationSystem.close()">
                    Continuar sin kits
                </button>
            </div>
        `;
    }

    /**
     * Renderizar tarjeta de kit
     */
    renderKitCard(kit) {
        return `
            <div class="kit-card" id="kit-${kit.id}" onclick="customizationSystem.toggleKit('${kit.id}')">
                <img src="${kit.image}" alt="${kit.name}" class="kit-image" 
                     onerror="this.style.display='none'">
                <div class="kit-info">
                    <h5 class="kit-name">${kit.name}</h5>
                    <p class="kit-description">${kit.description}</p>
                    <p class="kit-price">+${APP_CONFIG.format.currency(kit.price)}</p>
                </div>
                <div class="kit-check">
                    <i class="fas fa-check"></i>
                </div>
            </div>
        `;
    }

    /**
     * Toggle selección de kit
     */
    toggleKit(kitId) {
        const card = document.getElementById(`kit-${kitId}`);
        if (!card) return;

        if (this.selectedKits.has(kitId)) {
            this.selectedKits.delete(kitId);
            card.classList.remove('selected');
        } else {
            this.selectedKits.add(kitId);
            card.classList.add('selected');
        }

        this.updateTotal();
    }

    /**
     * Actualizar total
     */
    updateTotal() {
        const totalEl = document.getElementById('customizationTotal');
        if (!totalEl || !this.currentVehicle) return;

        let total = this.currentVehicle.price;
        this.selectedKits.forEach(kitId => {
            const kit = APP_CONFIG.customizationKits[kitId];
            if (kit) total += kit.price;
        });

        totalEl.textContent = APP_CONFIG.format.currency(total);
    }

    /**
     * Enviar cotización por WhatsApp
     */
    sendToWhatsApp() {
        if (!this.currentVehicle) return;

        let message = `Hola, me interesa el ${this.currentVehicle.name} (${this.currentVehicle.year}).`;

        if (this.selectedKits.size > 0) {
            const kitNames = Array.from(this.selectedKits).map(id => APP_CONFIG.customizationKits[id]?.name).filter(Boolean);
            message += ` Me gustaría incluir los siguientes kits de personalización: ${kitNames.join(', ')}.`;
        }

        message += ' ¿Podrían darme más información?';

        const url = `https://wa.me/${APP_CONFIG.whatsapp.number}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');

        this.trackEvent('customize_contact', this.currentVehicle.name);
        this.close();
    }

    /**
     * Cerrar modal
     */
    close() {
        const modal = document.getElementById('customizationModal');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
        this.currentVehicle = null;
        this.selectedKits.clear();
    }

    /**
     * Track evento
     */
    trackEvent(eventName, label) {
        if (typeof gtag !== 'undefined' && APP_CONFIG.analytics.enabled) {
            gtag('event', eventName, {
                'event_category': 'Customization',
                'event_label': label
            });
        }
    }
}

// Crear instancia global
const customizationSystem = new CustomizationSystem();
window.customizationSystem = customizationSystem;

/* ========================================
   FIN DE CUSTOMIZATION.JS
   ======================================== */
