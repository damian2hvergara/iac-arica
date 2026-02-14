/* ========================================
   vehicles.js - Lógica de Vehículos
   MEJORADO Y CORREGIDO: Con visualización de kits, deep link y share premium
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

// CARGAR VEHÍCULOS - CORREGIDO
async function loadVehicles(filter = 'all') {
    const container = document.getElementById('vehiclesContainer');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const emptyState = document.getElementById('emptyState');
    
    try {
        if (loadingSpinner) loadingSpinner.style.display = 'flex';
        if (container) container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'none';
        
        // CORREGIDO: Solo cargar de BD si no es filtro customizable
        if (filter !== 'customizable') {
            const status = filter === 'all' ? null : filter;
            currentVehicles = await vehicleAPI.getAllVehicles(status);
        }
        
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        
        if (currentVehicles.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }
        
        // CORREGIDO: Filtrar customizable DESPUÉS de tener datos
        let vehiclesToRender = currentVehicles;
        if (filter === 'customizable') {
            vehiclesToRender = currentVehicles.filter(v => 
                v.kits && v.kits.length > 0
            );
            
            if (vehiclesToRender.length === 0) {
                if (emptyState) {
                    emptyState.innerHTML = `
                        <i class="fas fa-magic"></i>
                        <h3>No hay vehículos con kits configurados</h3>
                        <p>Estamos agregando más opciones de personalización</p>
                    `;
                    emptyState.style.display = 'block';
                }
                return;
            }
        }
        
        renderVehicles(vehiclesToRender);
        handleDeepLink(); // 👈 NUEVO: deep link automático
        await updateStockCounters();
        await updateCustomizableCount(); // Actualiza siempre
        
    } catch (error) {
        console.error('Error:', error);
        if (loadingSpinner) loadingSpinner.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        showError('Error al cargar vehículos');
    }
}

// RENDERIZAR VEHÍCULOS - MEJORADO
function renderVehicles(vehicles) {
    const container = document.getElementById('vehiclesContainer');
    if (!container) return;
    
    container.innerHTML = vehicles.map(vehicle => {
        const statusConfig = APP_CONFIG.vehicleStatuses[vehicle.status];
        const hasKits = vehicle.kits && vehicle.kits.length > 0;
        
        console.log(`Vehículo ${vehicle.name}: ${hasKits ? vehicle.kits.length : 0} kits`);
        
        return `
            <div class="vehicle-card">
                <div style="position: relative;">
                    <img src="${vehicle.baseImage}" 
                         alt="${vehicle.name}" 
                         class="vehicle-image"
                         onclick="openGallery('${vehicle.id}')"
                         loading="lazy">
                    
                    <!-- Badge de Kits Disponibles -->
                    ${hasKits ? 
                        `<div style="position: absolute; top: 12px; right: 12px; background: linear-gradient(135deg, var(--import-red) 0%, #8b0707 100%); color: white; padding: 8px 14px; border-radius: 20px; font-size: 11px; font-weight: 700; backdrop-filter: blur(10px); box-shadow: 0 4px 12px rgba(99,11,11,0.4); display: flex; align-items: center; gap: 6px; z-index: 5;">
                            <i class="fas fa-star" style="font-size: 10px;"></i>
                            ${vehicle.kits.length} Kit${vehicle.kits.length > 1 ? 's' : ''}
                        </div>`
                     : ''}
                    
                    <!-- BOTÓN SHARE PREMIUM (NUEVO) -->
                    <button onclick="shareVehicle('${vehicle.id}', this)" 
                            class="share-btn-premium">
                        <i class="fas fa-share-alt"></i>
                        <span class="share-count">${vehicle.shareCount || 0}</span>
                    </button>
                </div>
                
                <div class="vehicle-info">
                    <div class="vehicle-status ${statusConfig.badge}">
                        ${statusConfig.label}
                    </div>
                    
                    <h3 class="vehicle-title">${vehicle.name}</h3>
                    
                    <div class="vehicle-price">$${formatPrice(vehicle.price)} CLP</div>
                    
                    <p class="vehicle-description">${vehicle.description || ''}</p>
                    
                    <!-- Mostrar kits disponibles -->
                    ${hasKits ? 
                        `<div style="margin: 12px 0; padding: 12px; background: var(--gray-50); border-radius: 8px; border-left: 3px solid var(--import-red);">
                            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--import-red); margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                                <i class="fas fa-magic" style="font-size: 10px;"></i>
                                Personalización Disponible
                            </div>
                            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                                ${vehicle.kits.slice(0, 2).map(kit => 
                                    `<span style="font-size: 11px; padding: 4px 10px; background: var(--white); border-radius: 12px; border: 1px solid var(--gray-200); font-weight: 500;">
                                        ${kit.name}
                                    </span>`
                                ).join('')}
                                ${vehicle.kits.length > 2 ? 
                                    `<span style="font-size: 11px; padding: 4px 10px; color: var(--gray-300); font-weight: 500;">
                                        +${vehicle.kits.length - 2} más
                                    </span>`
                                 : ''}
                            </div>
                        </div>`
                     : ''}
                    
                    ${vehicle.status === 'transit' && vehicle.transit_time ? 
                        `<div class="transit-timer">
                            <div class="timer-icon">
                                <i class="fas fa-shipping-fast"></i>
                            </div>
                            <div>
                                <div class="timer-text">Llega en</div>
                                <div class="timer-display">${vehicle.transit_time} días</div>
                            </div>
                        </div>`
                     : ''}
                    
                    <!-- Botones: Personalizar (si tiene kits), Comprar (antes "Detalles"), Consultas -->
                    <div class="vehicle-actions" style="gap: 8px; display: grid; grid-template-columns: ${hasKits ? '1fr 1fr 1fr' : '1fr 1fr'};">
                        ${hasKits ? 
                            `<button class="button" onclick="openCustomization('${vehicle.id}')" style="background: linear-gradient(135deg, var(--import-red) 0%, #8b0707 100%); box-shadow: 0 4px 12px rgba(99,11,11,0.3); font-size: 13px; padding: 10px 12px;">
                                <i class="fas fa-magic"></i> Personalizar
                            </button>`
                         : ''}
                        <button class="button ${hasKits ? 'button-outline' : ''}" onclick="showVehicleDetails('${vehicle.id}')" style="font-size: 13px; padding: 10px 12px;">
                            <i class="fas fa-shopping-cart"></i> Comprar   <!-- 👈 Cambiado de "Detalles" a "Comprar" -->
                        </button>
                        <button class="button button-outline" onclick="openConsultation('${vehicle.id}')" style="font-size: 13px; padding: 10px 12px;">
                            <i class="fas fa-question-circle"></i> Consultas
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

// ACTUALIZAR CONTADOR DE CUSTOMIZABLES - CORREGIDO
async function updateCustomizableCount() {
    const customizableCount = document.getElementById('customizableCount');
    if (!customizableCount) return;
    
    // CORREGIDO: Cargar todos los vehículos si currentVehicles está vacío
    let vehicles = currentVehicles;
    if (!vehicles || vehicles.length === 0) {
        try {
            vehicles = await vehicleAPI.getAllVehicles();
            currentVehicles = vehicles; // Guardar para uso futuro
        } catch (error) {
            console.error('Error al obtener vehículos:', error);
            return;
        }
    }
    
    const count = vehicles.filter(v => 
        v.kits && v.kits.length > 0
    ).length;
    
    customizableCount.textContent = count;
    
    console.log(`✅ Vehículos con kits: ${count}/${vehicles.length}`);
}

// MOSTRAR DETALLES - MEJORADO
async function showVehicleDetails(vehicleId) {
    try {
        const vehicle = await vehicleAPI.getVehicle(vehicleId);
        selectedVehicle = vehicle;
        
        const modal = document.getElementById('vehicleDetailsModal');
        const content = document.getElementById('vehicleDetailsContent');
        
        if (!modal || !content) return;
        
        trackEvent('view', 'Vehicle Details', vehicle.name);
        
        const hasKits = vehicle.kits && vehicle.kits.length > 0;
        
        content.innerHTML = `
            <div style="padding: 32px;">
                <h2 style="font-size: 28px; font-weight: 700; margin-bottom: 8px;">${vehicle.name}</h2>
                <p style="color: var(--gray-300); margin-bottom: 24px;">${vehicle.description || ''}</p>
                
                <div style="margin-bottom: 32px;">
                    <div style="position: relative; border-radius: var(--radius); overflow: hidden; border: var(--border); height: 400px; margin-bottom: 16px; cursor: pointer;" onclick="openGallery('${vehicle.id}')">
                        <img src="${vehicle.gallery[0] || vehicle.baseImage}" alt="${vehicle.name}" style="width: 100%; height: 100%; object-fit: cover;" id="mainDetailImage">
                    </div>
                    
                    ${vehicle.gallery.length > 1 ? 
                        `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 12px;">
                            ${vehicle.gallery.map((img, index) => 
                                `<img src="${img}" 
                                     alt="Vista ${index + 1}" 
                                     style="width: 100%; height: 80px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 2px solid ${index === 0 ? 'var(--import-red)' : 'transparent'};"
                                     onclick="changeDetailImage('${img}', this)">`
                            ).join('')}
                        </div>`
                     : ''}
                    
                    ${vehicle.video_id ? 
                        `<div style="position: relative; padding-bottom: 56.25%; height: 0; border-radius: var(--radius); overflow: hidden; margin-top: 16px; border: var(--border);">
                            <iframe src="https://www.youtube.com/embed/${vehicle.video_id}" 
                                    style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
                                    frameborder="0" allowfullscreen>
                            </iframe>
                        </div>`
                     : ''}
                </div>
                
                <!-- Sección de Kits si están disponibles -->
                ${hasKits ? 
                    `<div style="background: var(--import-red-light); padding: 32px; border-radius: 12px; margin-bottom: 32px; border: 1px solid rgba(99,11,11,0.2);">
                        <h3 style="font-size: 21px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; gap: 12px;">
                            <i class="fas fa-magic" style="color: var(--import-red);"></i> 
                            Kits de Personalización Disponibles
                        </h3>
                        <p style="color: var(--gray-300); margin-bottom: 24px; font-size: 15px;">
                            Este vehículo cuenta con ${vehicle.kits.length} kit${vehicle.kits.length > 1 ? 's' : ''} configurado${vehicle.kits.length > 1 ? 's' : ''}
                        </p>
                        
                        <div style="display: grid; gap: 16px;">
                            ${vehicle.kits.map(kit => 
                                `<div style="background: var(--white); padding: 20px; border-radius: 8px; border: 1px solid var(--gray-200);">
                                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                                        <div>
                                            <div style="font-size: 17px; font-weight: 600; margin-bottom: 4px;">
                                                ${kit.name}
                                            </div>
                                            <div style="font-size: 13px; color: var(--gray-300);">
                                                ${kit.description || ''}
                                            </div>
                                        </div>
                                        <div style="font-size: 18px; font-weight: 700; color: ${kit.price > 0 ? 'var(--import-red)' : 'var(--gray-300)'}; white-space: nowrap; margin-left: 16px;">
                                            ${kit.price > 0 ? '+$' + formatPrice(kit.price) : 'Incluido'}
                                        </div>
                                    </div>
                                    
                                    ${kit.features && kit.features.length > 0 ? 
                                        `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; margin-top: 12px;">
                                            ${kit.features.map(feature => 
                                                `<div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--gray-800);">
                                                    <i class="fas fa-check" style="color: var(--import-red); font-size: 11px;"></i>
                                                    <span>${feature}</span>
                                                </div>`
                                            ).join('')}
                                        </div>`
                                     : ''}
                                </div>`
                            ).join('')}
                        </div>
                        
                        <div style="margin-top: 20px; padding: 16px; background: var(--white); border-radius: 8px; border-left: 3px solid var(--import-red);">
                            <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px; color: var(--import-red);">
                                <i class="fas fa-info-circle"></i> Importante
                            </div>
                            <div style="font-size: 13px; color: var(--gray-300); line-height: 1.5;">
                                La personalización se realiza antes de la entrega, manteniendo la versión original del vehículo.
                            </div>
                        </div>
                    </div>`
                 : ''}
                
                <h3 style="font-size: 17px; font-weight: 600; margin-bottom: 20px;">Especificaciones Técnicas</h3>
                <div style="background: var(--gray-50); padding: 24px; border-radius: var(--radius); margin-bottom: 32px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                        ${Object.entries(vehicle.specifications).filter(([_, value]) => value).map(([key, value]) => 
                            `<div>
                                <div style="font-size: 12px; color: var(--gray-300); text-transform: uppercase; margin-bottom: 4px;">
                                    ${key}
                                </div>
                                <div style="font-weight: 500;">${value}</div>
                            </div>`
                        ).join('')}
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
                    ${hasKits ? 
                        `<button class="button button-outline" onclick="closeVehicleDetails(); openCustomization('${vehicle.id}')" style="flex: 1; min-width: 200px;">
                            <i class="fas fa-magic"></i> Personalizar
                        </button>`
                     : ''}
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

/* ========================================
   SHARE PREMIUM + CONTADOR (NUEVO)
   ======================================== */

function shareVehicle(vehicleId, buttonElement = null) {
    const vehicle = currentVehicles.find(v => v.id === vehicleId) || selectedVehicle;
    if (!vehicle) return;

    if (!vehicle.shareCount) vehicle.shareCount = 0;
    vehicle.shareCount++;

    if (buttonElement) {
        const counter = buttonElement.querySelector(".share-count");
        if (counter) counter.textContent = vehicle.shareCount;

        buttonElement.classList.add("share-animate");
        setTimeout(() => {
            buttonElement.classList.remove("share-animate");
        }, 400);
    }

    const vehicleUrl = `${window.location.origin}?v=${vehicle.id}`;
    const message = `Mira esta ${vehicle.name} disponible en Arica por $${formatPrice(vehicle.price)} CLP:\n${vehicleUrl}`;

    trackEvent('share', 'Vehicle', vehicle.name);

    if (navigator.share) {
        navigator.share({
            title: vehicle.name,
            text: message,
            url: vehicleUrl
        }).catch(() => {});
    } else {
        window.open(
            `https://wa.me/?text=${encodeURIComponent(message)}`,
            '_blank'
        );
    }
}

/* ========================================
   DEEP LINK ?v= (NUEVO)
   ======================================== */

function handleDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const vehicleId = params.get("v");
    if (!vehicleId) return;

    setTimeout(() => {
        const vehicleCard = document.querySelector(
            `[onclick="openGallery('${vehicleId}')"]`
        )?.closest('.vehicle-card');

        if (vehicleCard) {
            vehicleCard.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });

            vehicleCard.style.transition = "0.4s";
            vehicleCard.style.boxShadow = "0 0 0 3px var(--import-red)";
            setTimeout(() => {
                vehicleCard.style.boxShadow = "";
            }, 2000);
        }

        showVehicleDetails(vehicleId);

    }, 800);
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

// EVENT LISTENERS - CORREGIDO
function setupEventListeners() {
    const filters = document.querySelectorAll('#vehicleFilters .filter-button');
    filters.forEach(filter => {
        filter.addEventListener('click', function() {
            const filterValue = this.getAttribute('data-filter');
            
            filters.forEach(f => f.classList.remove('active'));
            this.classList.add('active');
            
            // CORREGIDO: Manejar filtro customizable
            if (filterValue === 'customizable') {
                // Filtrar de los vehículos ya cargados
                const customizableVehicles = currentVehicles.filter(v => 
                    v.kits && v.kits.length > 0
                );
                
                console.log('🔍 Filtro customizable activado');
                console.log('📊 Total vehículos:', currentVehicles.length);
                console.log('✨ Con kits:', customizableVehicles.length);
                
                if (customizableVehicles.length === 0) {
                    const emptyState = document.getElementById('emptyState');
                    const container = document.getElementById('vehiclesContainer');
                    if (container) container.innerHTML = '';
                    if (emptyState) {
                        emptyState.innerHTML = `
                            <i class="fas fa-magic"></i>
                            <h3>No hay vehículos con kits configurados</h3>
                            <p>Estamos agregando más opciones de personalización</p>
                        `;
                        emptyState.style.display = 'block';
                    }
                } else {
                    const emptyState = document.getElementById('emptyState');
                    if (emptyState) emptyState.style.display = 'none';
                    renderVehicles(customizableVehicles);
                }
            } else {
                loadVehicles(filterValue);
            }
            
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

console.log('✅ Vehicles.js cargado - Versión CORREGIDA con filtro de kits, deep link y share premium');
