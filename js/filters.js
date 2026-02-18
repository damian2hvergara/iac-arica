/* ========================================
   filters.js — Filtro doble: Tipo + Estado
   Depende de: config.js (APP_CONFIG.vehicleTypes)
               vehicles.js (renderVehicles)
   ======================================== */

class FilterSystem {
    constructor() {
        this.currentType   = 'all';
        this.currentStatus = 'all';
        this.vehicles      = [];
    }

    // Llamado desde loadVehicles() con los datos ya cargados
    init(vehicles) {
        this.vehicles = vehicles;
        this._renderTypeRow();
        this._renderStatusRow();
        this._bindEvents();
        this._apply(); // primera pasada: muestra todos
    }

    // ── Fila de tipos (Todos / Pickup / SUV / Muscle / Off-Road) ──
    _renderTypeRow() {
        const container = document.getElementById('typeFilters');
        if (!container) return;

        container.innerHTML = Object.entries(APP_CONFIG.vehicleTypes)
            .map(([id, cfg]) => {
                const count    = id === 'all'
                    ? this.vehicles.length
                    : this.vehicles.filter(v => v.type === id).length;
                const disabled = count === 0 && id !== 'all' ? 'disabled' : '';
                const active   = id === this.currentType ? 'active' : '';
                return `<button class="type-filter-btn ${active}" data-type="${id}" ${disabled}>
                    <i class="fas ${cfg.icon}"></i>
                    <span>${cfg.label}</span>
                    <span class="filter-count">${count}</span>
                </button>`;
            }).join('');
    }

    // ── Fila de estados (Todos / En Stock / En Tránsito / Para Reservar) ──
    _renderStatusRow() {
        const container = document.getElementById('statusFilters');
        if (!container) return;

        const statuses = [
            { id: 'all',     label: 'Todos' },
            { id: 'stock',   label: 'En Stock',      dot: true },
            { id: 'transit', label: 'En Tránsito',   dot: true },
            { id: 'reserve', label: 'Para Reservar', dot: true }
        ];

        container.innerHTML = statuses.map(s => {
            const active = s.id === this.currentStatus ? 'active' : '';
            const dot    = s.dot ? `<span class="status-dot status-dot-${s.id}"></span>` : '';
            return `<button class="status-filter-btn ${active}" data-status="${s.id}">
                ${dot}${s.label}
            </button>`;
        }).join('');
    }

    // ── Eventos ───────────────────────────────────────────
    _bindEvents() {
        document.getElementById('typeFilters')?.addEventListener('click', e => {
            const btn = e.target.closest('.type-filter-btn');
            if (btn && !btn.disabled) {
                this.currentType = btn.dataset.type;
                this._apply();
                this._updateActive();
                trackEvent('filter_type', 'Vehicles', this.currentType);
            }
        });

        document.getElementById('statusFilters')?.addEventListener('click', e => {
            const btn = e.target.closest('.status-filter-btn');
            if (btn) {
                this.currentStatus = btn.dataset.status;
                this._apply();
                this._updateActive();
                trackEvent('filter_status', 'Vehicles', this.currentStatus);
            }
        });
    }

    // ── Aplicar ambos filtros y re-renderizar ─────────────
    _apply() {
        const result = this.vehicles.filter(v => {
            const okType   = this.currentType   === 'all' || v.type   === this.currentType;
            const okStatus = this.currentStatus === 'all' || v.status === this.currentStatus;
            return okType && okStatus;
        });

        renderVehicles(result);

        const emptyState = document.getElementById('emptyState');
        if (emptyState) emptyState.style.display = result.length === 0 ? 'block' : 'none';
    }

    // ── Marcar botón activo visualmente ───────────────────
    _updateActive() {
        document.querySelectorAll('.type-filter-btn').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.type === this.currentType));
        document.querySelectorAll('.status-filter-btn').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.status === this.currentStatus));
    }
}

const filterSystem = new FilterSystem();
window.filterSystem = filterSystem;

console.log('✅ filters.js cargado');
