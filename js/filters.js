/* ========================================
   filters.js - Sistema de Filtros
   Import American Cars
   ======================================== */

class FilterSystem {
    constructor() {
        this.currentType = 'all';
        this.currentStatus = 'all';
        this.vehicles = [];
        this.filteredVehicles = [];
        this.onFilterChange = null;
    }

    /**
     * Inicializar sistema de filtros
     */
    init(vehicles, onFilterChange) {
        this.vehicles = vehicles;
        this.filteredVehicles = [...vehicles];
        this.onFilterChange = onFilterChange;
        
        this.renderTypeFilters();
        this.renderStatusFilters();
        this.setupEventListeners();
        this.updateCounts();
    }

    /**
     * Renderizar filtros por tipo
     */
    renderTypeFilters() {
        const container = document.getElementById('typeFilters');
        if (!container) return;

        const types = APP_CONFIG.vehicleTypes;
        let html = '';

        for (const [typeId, typeConfig] of Object.entries(types)) {
            const count = this.countByType(typeId);
            const isActive = this.currentType === typeId;
            
            html += `
                <button class="type-filter-btn ${isActive ? 'active' : ''}" 
                        data-type="${typeId}"
                        ${count === 0 && typeId !== 'all' ? 'disabled' : ''}>
                    ${typeConfig.label}
                    <span class="count">${count}</span>
                </button>
            `;
        }

        container.innerHTML = html;
    }

    /**
     * Renderizar filtros por estado
     */
    renderStatusFilters() {
        const container = document.getElementById('statusFilters');
        if (!container) return;

        const statuses = [
            { id: 'all', label: 'Todos' },
            { id: 'stock', label: 'En stock', dot: 'stock' },
            { id: 'transit', label: 'En tránsito', dot: 'transit' },
            { id: 'reserve', label: 'Reservar', dot: 'reserve' }
        ];

        let html = '';

        for (const status of statuses) {
            const count = status.id === 'all' 
                ? this.vehicles.length 
                : this.countByStatus(status.id);
            const isActive = this.currentStatus === status.id;
            
            html += `
                <button class="status-filter-btn ${isActive ? 'active' : ''}" 
                        data-status="${status.id}">
                    ${status.dot ? `<span class="status-dot status-dot-${status.dot}"></span>` : ''}
                    ${status.label}
                </button>
            `;
        }

        container.innerHTML = html;
    }

    /**
     * Configurar event listeners
     */
    setupEventListeners() {
        // Filtros de tipo
        document.getElementById('typeFilters')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.type-filter-btn');
            if (btn && !btn.disabled) {
                this.setTypeFilter(btn.dataset.type);
            }
        });

        // Filtros de estado
        document.getElementById('statusFilters')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.status-filter-btn');
            if (btn) {
                this.setStatusFilter(btn.dataset.status);
            }
        });
    }

    /**
     * Establecer filtro de tipo
     */
    setTypeFilter(type) {
        this.currentType = type;
        this.applyFilters();
        this.updateActiveStates();
        this.trackFilter('type', type);
    }

    /**
     * Establecer filtro de estado
     */
    setStatusFilter(status) {
        this.currentStatus = status;
        this.applyFilters();
        this.updateActiveStates();
        this.trackFilter('status', status);
    }

    /**
     * Aplicar filtros
     */
    applyFilters() {
        this.filteredVehicles = this.vehicles.filter(vehicle => {
            const matchesType = this.currentType === 'all' || vehicle.type === this.currentType;
            const matchesStatus = this.currentStatus === 'all' || vehicle.status === this.currentStatus;
            return matchesType && matchesStatus;
        });

        if (this.onFilterChange && typeof this.onFilterChange === 'function') {
            this.onFilterChange(this.filteredVehicles);
        }
    }

    /**
     * Actualizar estados activos de botones
     */
    updateActiveStates() {
        // Type filters
        document.querySelectorAll('.type-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === this.currentType);
        });

        // Status filters
        document.querySelectorAll('.status-filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.status === this.currentStatus);
        });
    }

    /**
     * Actualizar contadores
     */
    updateCounts() {
        // Actualizar contadores de tipo
        document.querySelectorAll('.type-filter-btn').forEach(btn => {
            const type = btn.dataset.type;
            const count = this.countByType(type);
            const countEl = btn.querySelector('.count');
            if (countEl) {
                countEl.textContent = count;
            }
            btn.disabled = count === 0 && type !== 'all';
        });
    }

    /**
     * Contar vehículos por tipo
     */
    countByType(type) {
        if (type === 'all') return this.vehicles.length;
        return this.vehicles.filter(v => v.type === type).length;
    }

    /**
     * Contar vehículos por estado
     */
    countByStatus(status) {
        return this.vehicles.filter(v => v.status === status).length;
    }

    /**
     * Limpiar filtros
     */
    clearFilters() {
        this.currentType = 'all';
        this.currentStatus = 'all';
        this.applyFilters();
        this.updateActiveStates();
    }

    /**
     * Obtener vehículos filtrados
     */
    getFilteredVehicles() {
        return this.filteredVehicles;
    }

    /**
     * Track en Analytics
     */
    trackFilter(filterType, value) {
        if (typeof gtag !== 'undefined' && APP_CONFIG.analytics.enabled) {
            gtag('event', filterType === 'type' ? 'filter_type' : 'filter_status', {
                'event_category': 'Vehicles',
                'event_label': value
            });
        }
    }
}

// Crear instancia global
const filterSystem = new FilterSystem();
window.filterSystem = filterSystem;

/* ========================================
   FIN DE FILTERS.JS
   ======================================== */
