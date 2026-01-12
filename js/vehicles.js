/* ========================================
   vehicles.js - Lógica de Vehículos
   ======================================== */

let currentVehicles = [];
let currentFilter = 'all';
let selectedVehicle = null;

// INICIALIZACIÓN
async function initializeApp() {
    try {
        vehicleAPI.init();
        console.log('✅ App inicializada');
    } catch (error) {
        console.error('❌ Error:', error);
        showError('Error al conectar con la base de datos');
    }
}

// CARGAR VEHÍCULOS
async function loadVehicles(filter = 'all') {
    const container = document.getElementById('vehiclesContainer');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const emptyState = document.getElementById('emptyState');
    
    try {
        if (loadingSpinner) loadingSpinner.style.display = 'flex';
        if (container) container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'none';
        
        const status = filter === 'all' ? null : filter;
        currentVehicles = await vehicleAPI.getAllVehicles(status);
        
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        
        if (currentVehicles.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        renderVehicles(currentVehicles);
        await updateStockCounters();
        
    } catch (error) {
        console.error('Error:', error);
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        showError('Error al cargar vehículos');
    }
}

// RENDERIZAR VEHÍCULOS
function renderVehicles(vehicles) {
    const container = document.getElementById('vehiclesContainer');
    if (!container) return;
    
    container.innerHTML = vehicles.map(vehicle => {
        const statusConfig = APP_CONFIG.vehicleStatuses[vehicle.status];
        
        return `
            <div class="vehicle-card">
                <img src="${vehicle.baseImage}" 
                     alt="${vehicle.name}" 
                     class="vehicle-image"
                     onclick="openGallery('${vehicle.id}')"
                     loading="lazy">
                
                <div class="vehicle-info">
                    <div class="vehicle-status ${statusConfig.badge}">
                        ${statusConfig.label}
                    </div>
                    
                    <h3 class="vehicle-title">${vehicle.name}</h3>
                    
                    <div class="vehicle-price">$${formatPrice(vehicle.price)} CLP</div>
                    
                    <p class="vehicle-description">${vehicle.description || ''}</p>
                    
                    ${vehicle.status === 'transit' && vehicle.transit_time ? `
                        <div class="transit-timer">
                            <div class="timer-icon">
                                <i class="fas fa-shipping-fast"></i>
                            </div>
                            <div>
                                <div class="timer-text">Llega en</div>
                                <div class="timer-display">${vehicle.transit_time} días</div>
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="vehicle-actions">
                        <button class="button" onclick="showVehicleDetails('${vehicle.id}')" style="flex: 1;">
                            Ver Detalles
                        </button>
                        <button class="button button-outline" onclick="openCustomization('${vehicle.id}')" style="flex: 1;">
                            Personalizar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ACTUALIZAR CONTADORES
async function updateStockCounters() {
    try {
        const stats = await vehicleAPI.getStats();
        
        const stockCount = document.getElementById('stockCount');
        const transitCount = document.getElementById('transitCount');
        const reserveCount = document.getElementById('reserveCount');
        
        if (stockCount) stockCount.textContent = stats.stock;
        if (transitCount) transitCount.textContent = stats.transit;
        if (reserveCount) reserveCount.textContent = stats.reserve;
        
    } catch (error) {
        console.error('Error:', error);
    }
}

// MOSTRAR DETALLES
async function showVehicleDetails(vehicleId) {
    try {
        const vehicle = await vehicleAPI.getVehicle(vehicleId);
        selectedVehicle = vehicle;
        
        const modal = document.getElementById('vehicleDetailsModal');
        const content = document.getElementById('vehicleDetailsContent');
        
        if (!modal || !content) return;
        
        trackEvent('view', 'Vehicle Details', vehicle.name);
        
        content.innerHTML = `
            <div style="padding: 32px;">
                <h2 style="font-size: 28px; font-weight: 700; margin-bottom: 8px;">${vehicle.name}</h2>
                <p style="color: var(--gray-300); margin-bottom: 24px;">${vehicle.description || ''}</p>
                
                <div style="margin-bottom: 32px;">
                    <div style="position: relative; border-radius: var(--radius); overflow: hidden; border: var(--border); height: 400px; margin-bottom: 16px; cursor: pointer;" onclick="openGallery('${vehicle.id}')">
                        <img src="${vehicle.gallery[0] || vehicle.baseImage}" alt="${vehicle.name}" style="width: 100%; height: 100%; object-fit: cover;" id="mainDetailImage">
                    </div>
                    
                    ${vehicle.gallery.length > 1 ? `
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 12px;">
                            ${vehicle.gallery.map((img, index) => `
                                <img src="${img}" 
                                     alt="Vista ${index + 1}" 
                                     style="width: 100%; height: 80px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 2px solid ${index === 0 ? 'var(--import-red)' : 'transparent'};"
                                     onclick="changeDetailImage('${img}', this)">
                            `).join('')}
                        </div>
                    ` : ''}
                    
                    ${vehicle.video_id ? `
                        <div style="position: relative; padding-bottom: 56.25%; height: 0; border-radius: var(--radius); overflow: hidden; margin-top: 16px; border: var(--border);">
                            <iframe src="https://www.youtube.com/embed/${vehicle.video_id}" 
                                    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
                                    frameborder="0" allowfullscreen>
                            </iframe>
                        </div>
                    ` : ''}
                </div>
                
                <h3 style="font-size: 17px; font-weight: 600; margin-bottom: 20px;">Especificaciones Técnicas</h3>
                <div style="background: var(--gray-50); padding: 24px; border-radius: var(--radius); margin-bottom: 32px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                        ${Object.entries(vehicle.specifications).filter(([_, value]) => value).map(([key, value]) => `
                            <div>
                                <div style="font-size: 12px; color: var(--gray-300); text-transform: uppercase; margin-bottom: 4px;">
                                    ${key}
                                </div>
                                <div style="font-weight: 500;">${value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div style="background: var(--gray-50); padding: 24px; border-radius: var(--radius); margin-bottom: 24px;">
                    <div style="font-size: 13px; color: var(--gray-300); margin-bottom: 8px;">Precio</div>
                    <div style="font-size: 32px; font-weight: 700;">$${formatPrice(vehicle.price)} CLP</div>
                    <div style="color: var(--gray-300); font-size: 14px; margin-top: 4px;">${vehicle.location} • ${vehicle.eta || 'Disponible'}</div>
                </div>
                
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                    <button class="button" onclick="contactVehicle('${vehicle.id}')" style="flex: 1; min-width: 200px;">
                        <i class="fab fa-whatsapp"></i> Consultar
                    </button>
                    <button class="button button-outline" onclick="closeVehicleDetails(); openCustomization('${vehicle.id}')" style="flex: 1; min-width: 200px;">
                        <i class="fas fa-cog"></i> Personalizar
                    </button>
                </div>
            </div>
        `;
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
    } catch (error) {
        console.error('Error:', error);
        showError('Error al cargar detalles');
    }
}

function changeDetailImage(imageUrl, element) {
    const mainImage = document.getElementById('mainDetailImage');
    if (mainImage) mainImage.src = imageUrl;
    
    const thumbnails = element.parentElement.querySelectorAll('img');
    thumbnails.forEach(thumb => {
        thumb.style.borderColor = thumb === element ? 'var(--import-red)' : 'transparent';
    });
}

function closeVehicleDetails() {
    const modal = document.getElementById('vehicleDetailsModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
    selectedVehicle = null;
}

// CONTACTAR
function contactVehicle(vehicleId) {
    const vehicle = currentVehicles.find(v => v.id === vehicleId) || selectedVehicle;
    if (!vehicle) return;
    
    const message = `Hola, estoy interesado en ${vehicle.name} ($${formatPrice(vehicle.price)} CLP). Estado: ${APP_CONFIG.vehicleStatuses[vehicle.status].label}. ¿Más información?`;
    
    trackEvent('contact', 'WhatsApp', vehicle.name);
    window.open(`https://wa.me/${CONTACT_CONFIG.whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
}

// ANIMACIÓN CONTADOR
function animateCounter() {
    const counterElement = document.getElementById('importedVehiclesCounter');
    if (!counterElement) return;
    
    const target = APP_CONFIG.importedVehiclesCount;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    let step = 0;
    
    const timer = setInterval(() => {
        step++;
        current = Math.min(Math.floor(increment * step), target);
        counterElement.textContent = current;
        
        if (step >= steps) {
            clearInterval(timer);
            counterElement.textContent = target;
        }
    }, duration / steps);
}

// EVENT LISTENERS
function setupEventListeners() {
    const filters = document.querySelectorAll('#vehicleFilters .filter-button');
    filters.forEach(filter => {
        filter.addEventListener('click', function() {
            const filterValue = this.getAttribute('data-filter');
            
            filters.forEach(f => f.classList.remove('active'));
            this.classList.add('active');
            
            loadVehicles(filterValue);
            trackEvent('filter', 'Vehicles', filterValue);
        });
    });
    
    const indicators = document.querySelectorAll('.stock-indicators .indicator');
    indicators.forEach(indicator => {
        indicator.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            if (filter) {
                const filterButton = document.querySelector(`#vehicleFilters [data-filter="${filter}"]`);
                if (filterButton) filterButton.click();
                
                scrollToElement('vehicles');
                trackEvent('click', 'Stock Indicator', filter);
            }
        });
    });
    
    const whatsappBtn = document.getElementById('whatsappBtn');
    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const message = 'Hola, estoy interesado en recibir asesoría para importar un vehículo desde USA.';
            trackEvent('click', 'Contact', 'WhatsApp Footer');
            window.open(`https://wa.me/${CONTACT_CONFIG.whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
        });
    }
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeVehicleDetails();
            closeCustomization();
            closeGallery();
        }
    });
    
    const vehicleModal = document.getElementById('vehicleDetailsModal');
    if (vehicleModal) {
        vehicleModal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                closeVehicleDetails();
            }
        });
    }
    
    let scrollTracked = { 25: false, 50: false, 75: false, 100: false };
    
    const trackScroll = throttle(() => {
        const scrollTop = window.scrollY;
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        const scrollPercent = (scrollTop / (docHeight - windowHeight)) * 100;
        
        Object.keys(scrollTracked).forEach(percent => {
            if (scrollPercent >= parseInt(percent) && !scrollTracked[percent]) {
                trackEvent('scroll', 'Engagement', `${percent}%`);
                scrollTracked[percent] = true;
            }
        });
    }, 1000);
    
    window.addEventListener('scroll', trackScroll);
}

console.log('✅ Vehicles.js cargado');
