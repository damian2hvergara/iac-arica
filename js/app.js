// Estado de la aplicación (compatible con tu código original)
let currentFilter = "all";
let selectedVehicle = null;
let selectedKit = null;
let currentGalleryIndex = 0;
let currentInstagramGallery = null;
let currentInstagramSlide = 0;

// Inicialización completa
document.addEventListener('DOMContentLoaded', async () => {
    // Cargar datos primero
    await DataLoader.load();
    
    // Iniciar aplicación con datos cargados
    initApp();
});

function initApp() {
    console.log('🚀 Iniciando aplicación...');
    
    updateStockCounts();
    loadVehicles();
    setupFilters();
    setupGalleryKeyboard();
    updateTransitTimers();
    animateCounter();
    
    console.log('✅ Aplicación lista');
}

// 1. Actualizar contadores de stock
function updateStockCounts() {
    const vehicles = DataLoader.getVehicles();
    
    const stockCount = vehicles.filter(v => v.status === "stock").length;
    const transitCount = vehicles.filter(v => v.status === "transit").length;
    const reserveCount = vehicles.filter(v => v.status === "reserve").length;
    
    const stockEl = document.getElementById('stockCount');
    const transitEl = document.getElementById('transitCount');
    const reserveEl = document.getElementById('reserveCount');
    
    if (stockEl) stockEl.textContent = stockCount;
    if (transitEl) transitEl.textContent = transitCount;
    if (reserveEl) reserveEl.textContent = reserveCount;
}

// 2. Cargar vehículos (TU FUNCIÓN ORIGINAL RESTAURADA)
function loadVehicles(filter = "all") {
    const container = document.getElementById('vehiclesContainer');
    if (!container) return;
    
    const vehicles = DataLoader.getVehicles();
    let filteredVehicles = vehicles;
    
    if (filter !== "all") {
        filteredVehicles = vehicles.filter(v => v.status === filter);
    }
    
    // Actualizar botones activos
    document.querySelectorAll('.filter-button').forEach(btn => {
        const filterText = btn.textContent.toLowerCase();
        if ((filter === "all" && filterText === "todos") || 
            (filter === "stock" && filterText === "en stock") ||
            (filter === "transit" && filterText === "en tránsito")) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Si no hay vehículos
    if (filteredVehicles.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px; grid-column: 1 / -1;">
                <div style="font-size: 48px; margin-bottom: 20px;">🚗</div>
                <h3 style="font-size: 21px; font-weight: 600; margin-bottom: 12px;">
                    ${filter === "all" ? "Inventario en actualización" : "No hay vehículos en esta categoría"}
                </h3>
                <p style="color: #86868b; max-width: 400px; margin: 0 auto;">
                    ${filter === "all" 
                        ? "Estamos preparando nuevos vehículos americanos para ti. Pronto tendremos disponibilidad." 
                        : "Prueba con otra categoría o ver todos los vehículos."}
                </p>
                ${filter !== "all" ? `
                    <button class="button" onclick="filterVehicles('all')" style="margin-top: 24px;">
                        Ver todos los vehículos
                    </button>
                ` : ''}
            </div>
        `;
        return;
    }
    
    // Renderizar vehículos (TU HTML ORIGINAL)
    container.innerHTML = filteredVehicles.map(vehicle => {
        const statusBadge = vehicle.status === 'stock' ? 
            'status-badge-stock' : 'status-badge-transit';
        const statusText = vehicle.status === 'stock' ? 
            'En Stock Arica' : 'En Tránsito';
        
        const hasGallery = vehicle.gallery && vehicle.gallery.length > 0;
        const mainImage = hasGallery ? vehicle.gallery[0] : vehicle.baseImage;
        
        return `
            <div class="vehicle-card">
                <img src="${mainImage}" alt="${vehicle.name}" class="vehicle-image" 
                     onclick="openInstagramGallery(${vehicle.id})">
                <div class="vehicle-info">
                    <div class="vehicle-status ${statusBadge}">
                        ${statusText}
                    </div>
                    <h3 class="vehicle-title">${vehicle.name}</h3>
                    <div class="vehicle-price">${CONFIG.formatPrice(vehicle.price)} CLP</div>
                    <p style="color: #86868b; font-size: 14px; margin-bottom: 16px;">${vehicle.description}</p>
                    
                    ${vehicle.transitTime ? `
                        <div class="transit-timer">
                            <div class="timer-icon">
                                <i class="fas fa-shipping-fast"></i>
                            </div>
                            <div>
                                <div class="timer-text">Llega en</div>
                                <div class="timer-display" id="timer-${vehicle.id}">${vehicle.transitTime} días</div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div style="display: flex; gap: 8px; margin-top: 16px;">
                        <button class="button" onclick="showVehicleDetails(${vehicle.id})" style="flex: 1;">
                            Ver Detalles
                        </button>
                        ${vehicle.kits && vehicle.kits.length > 0 ? `
                            <button class="button button-outline" onclick="customizeVehicle(${vehicle.id})" style="flex: 1;">
                                Personalizar
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Scroll suave si se filtró
    if (filter !== "all" && filteredVehicles.length > 0) {
        setTimeout(() => {
            const vehiclesSection = document.getElementById('vehicles');
            if (vehiclesSection) {
                vehiclesSection.scrollIntoView({ behavior: 'smooth' });
            }
        }, 300);
    }
}

// 3. Filtrar vehículos
function filterVehicles(filter) {
    currentFilter = filter;
    trackEvent('filter', 'Vehicles', filter);
    loadVehicles(filter);
}

// 4. Configurar filtros
function setupFilters() {
    // Filtros principales
    document.querySelectorAll('.filter-button').forEach(btn => {
        btn.addEventListener('click', function() {
            const filter = this.dataset.filter;
            if (filter) {
                filterVehicles(filter);
            }
        });
    });
    
    // Indicadores del hero
    document.querySelectorAll('.indicator').forEach(ind => {
        ind.addEventListener('click', function() {
            const filter = this.dataset.filter;
            if (filter) {
                filterVehicles(filter);
            }
        });
    });
}

// 5. Actualizar temporizadores de tránsito
function updateTransitTimers() {
    const vehicles = DataLoader.getVehicles();
    const transitVehicles = vehicles.filter(v => v.status === "transit");
    
    transitVehicles.forEach(vehicle => {
        const timerElement = document.getElementById(`timer-${vehicle.id}`);
        if (timerElement && vehicle.transitTime) {
            let daysLeft = vehicle.transitTime;
            
            const updateTimer = () => {
                if (daysLeft > 0) {
                    timerElement.textContent = `${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`;
                    
                    if (daysLeft <= 5) {
                        timerElement.style.color = 'var(--green)';
                    } else if (daysLeft <= 10) {
                        timerElement.style.color = 'var(--orange)';
                    }
                } else {
                    timerElement.textContent = '¡Próxima semana!';
                    timerElement.style.color = 'var(--green)';
                }
            };
            
            updateTimer();
        }
    });
}

// 6. Animación contador
function animateCounter() {
    const counterElement = document.getElementById('importedVehiclesCounter');
    if (!counterElement) return;
    
    const targetNumber = CONFIG.STATE.importedCounter;
    if (targetNumber <= 0) return;
    
    const duration = 2000;
    const steps = 60;
    const increment = targetNumber / steps;
    let current = 0;
    let step = 0;
    
    const timer = setInterval(() => {
        step++;
        current = Math.min(Math.floor(increment * step), targetNumber);
        counterElement.textContent = current;
        
        if (step >= steps) {
            clearInterval(timer);
            counterElement.textContent = targetNumber;
        }
    }, duration / steps);
}

// 7. Configurar teclado para galería
function setupGalleryKeyboard() {
    document.addEventListener('keydown', (e) => {
        const galleryModal = document.getElementById('instagramGalleryModal');
        if (galleryModal && galleryModal.style.display === 'block') {
            if (e.key === 'Escape') {
                closeInstagramGallery();
            } else if (e.key === 'ArrowRight') {
                changeGallerySlide(1);
            } else if (e.key === 'ArrowLeft') {
                changeGallerySlide(-1);
            } else if (e.key === ' ') {
                const activeSlide = document.querySelector('.gallery-slide.active img');
                if (activeSlide) toggleZoom(activeSlide);
                e.preventDefault();
            }
        }
    });
}

// Hacer funciones disponibles globalmente
window.filterVehicles = filterVehicles;
window.loadVehicles = loadVehicles;
window.updateStockCounts = updateStockCounts;
