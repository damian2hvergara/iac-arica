// Estado
let currentFilter = "all";
let selectedVehicle = null;
let selectedKit = null;
let currentGalleryIndex = 0;
let currentInstagramGallery = null;
let currentInstagramSlide = 0;

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    updateStockCounts();
    loadVehicles();
    setupFilters();
    setupGalleryKeyboard();
    updateTransitTimers();
    
    // Iniciar contador animado
    animateCounter();
});

// Configurar teclado para galería
function setupGalleryKeyboard() {
    document.addEventListener('keydown', (e) => {
        const galleryModal = document.getElementById('instagramGalleryModal');
        if (galleryModal.style.display === 'block') {
            if (e.key === 'Escape') {
                closeInstagramGallery();
            } else if (e.key === 'ArrowRight') {
                changeGallerySlide(1);
            } else if (e.key === 'ArrowLeft') {
                changeGallerySlide(-1);
            } else if (e.key === ' ') {
                toggleZoom();
                e.preventDefault();
            }
        }
    });
}

// Actualizar contadores de stock
function updateStockCounts() {
    const stockCount = vehicles.filter(v => v.status === "stock").length;
    const transitCount = vehicles.filter(v => v.status === "transit").length;
    
    document.getElementById('stockCount').textContent = stockCount;
    document.getElementById('transitCount').textContent = transitCount;
}

// Formatear precio
function formatPrice(price) {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// Animación contador vehículos importados
function animateCounter() {
    const counterElement = document.getElementById('importedVehiclesCounter');
    const targetNumber = 142;
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

// Cargar vehículos (FUNCIÓN ORIGINAL RESTAURADA)
function loadVehicles(filter = "all") {
    const container = document.getElementById('vehiclesContainer');
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
    
    // Renderizar vehículos
    container.innerHTML = filteredVehicles.map(vehicle => {
        const statusBadge = vehicle.status === 'stock' ? 
            'status-badge-stock' : 'status-badge-transit';
        const statusText = vehicle.status === 'stock' ? 
            'En Stock Arica' : 'En Tránsito';
        
        return `
            <div class="vehicle-card">
                <img src="${vehicle.baseImage}" alt="${vehicle.name}" class="vehicle-image" 
                     onclick="openInstagramGallery(${vehicle.id}); trackEvent('click', 'Gallery', '${vehicle.name}')">
                <div class="vehicle-info">
                    <div class="vehicle-status ${statusBadge}">
                        ${statusText}
                    </div>
                    <h3 class="vehicle-title">${vehicle.name}</h3>
                    <div class="vehicle-price">$${formatPrice(vehicle.price)} CLP</div>
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
                        <button class="button" onclick="showVehicleDetails(${vehicle.id}); trackEvent('click', 'Vehicle', '${vehicle.name} Details')" style="flex: 1;">
                            Ver Detalles
                        </button>
                        <button class="button button-outline" onclick="customizeVehicle(${vehicle.id}); trackEvent('click', 'Customize', '${vehicle.name}')" style="flex: 1;">
                            Personalizar
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Scroll suave si se filtró
    if (filter !== "all" && filteredVehicles.length > 0) {
        setTimeout(() => {
            document.getElementById('vehicles').scrollIntoView({ behavior: 'smooth' });
        }, 300);
    }
}

// Actualizar temporizadores de tránsito
function updateTransitTimers() {
    const transitVehicles = vehicles.filter(v => v.status === "transit");
    
    transitVehicles.forEach(vehicle => {
        const timerElement = document.getElementById(`timer-${vehicle.id}`);
        if (timerElement && vehicle.transitTime) {
            // Simular cuenta regresiva
            let daysLeft = vehicle.transitTime;
            
            const updateTimer = () => {
                if (daysLeft > 0) {
                    timerElement.textContent = `${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`;
                    
                    // Cambiar color según días restantes
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

// Filtrar vehículos
function filterVehicles(filter) {
    currentFilter = filter;
    trackEvent('filter', 'Vehicles', filter);
    loadVehicles(filter);
}

// Configurar filtros
function setupFilters() {
    document.querySelectorAll('.filter-button').forEach(btn => {
        btn.addEventListener('click', function() {
            const text = this.textContent.toLowerCase();
            let filter = "all";
            
            if (text === "en stock") filter = "stock";
            else if (text === "en tránsito") filter = "transit";
            
            filterVehicles(filter);
        });
    });
}

// NUEVO: Abrir galería Instagram
function openInstagramGallery(vehicleId) {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;
    
    currentInstagramGallery = vehicle;
    currentInstagramSlide = 0;
    
    trackEvent('open', 'Gallery', vehicle.name);
    
    const modal = document.getElementById('instagramGalleryModal');
    const slidesContainer = document.getElementById('gallerySlidesContainer');
    const dotsContainer = document.getElementById('galleryDots');
    
    // Crear slides
    slidesContainer.innerHTML = vehicle.gallery.map((img, index) => `
        <div class="gallery-slide ${index === 0 ? 'active' : ''}">
            <img src="${img}" alt="${vehicle.name} - Imagen ${index + 1}" 
                 onclick="toggleZoom(this)"
                 ondblclick="toggleZoom(this)"
                 loading="lazy">
        </div>
    `).join('');
    
    // Crear dots
    dotsContainer.innerHTML = vehicle.gallery.map((_, index) => `
        <div class="gallery-dot ${index === 0 ? 'active' : ''}" onclick="goToSlide(${index})"></div>
    `).join('');
    
    // Actualizar contador
    updateGalleryCounter();
    
    // Mostrar modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// NUEVO: Cambiar slide de galería
function changeGallerySlide(direction) {
    if (!currentInstagramGallery) return;
    
    const slides = document.querySelectorAll('.gallery-slide');
    const dots = document.querySelectorAll('.gallery-dot');
    
    // Quitar zoom si está activo
    const currentSlide = slides[currentInstagramSlide];
    if (currentSlide) {
        const img = currentSlide.querySelector('img');
        if (img && img.classList.contains('zoomed')) {
            img.classList.remove('zoomed');
        }
    }
    
    // Calcular nuevo índice
    const newIndex = (currentInstagramSlide + direction + slides.length) % slides.length;
    
    // Actualizar slides
    slides[currentInstagramSlide].classList.remove('active');
    slides[newIndex].classList.add('active');
    
    // Actualizar dots
    dots[currentInstagramSlide].classList.remove('active');
    dots[newIndex].classList.add('active');
    
    currentInstagramSlide = newIndex;
    updateGalleryCounter();
    
    trackEvent('navigation', 'Gallery', `Slide ${newIndex + 1}`);
}

// NUEVO: Ir a slide específico
function goToSlide(index) {
    if (!currentInstagramGallery) return;
    
    const slides = document.querySelectorAll('.gallery-slide');
    const dots = document.querySelectorAll('.gallery-dot');
    
    // Quitar zoom si está activo
    const currentSlide = slides[currentInstagramSlide];
    if (currentSlide) {
        const img = currentSlide.querySelector('img');
        if (img && img.classList.contains('zoomed')) {
            img.classList.remove('zoomed');
        }
    }
    
    // Actualizar slides
    slides[currentInstagramSlide].classList.remove('active');
    slides[index].classList.add('active');
    
    // Actualizar dots
    dots[currentInstagramSlide].classList.remove('active');
    dots[index].classList.add('active');
    
    currentInstagramSlide = index;
    updateGalleryCounter();
}

// NUEVO: Toggle zoom
function toggleZoom(imgElement) {
    imgElement.classList.toggle('zoomed');
    trackEvent('zoom', 'Gallery', imgElement.classList.contains('zoomed') ? 'Zoom In' : 'Zoom Out');
}

// NUEVO: Actualizar contador de galería
function updateGalleryCounter() {
    if (!currentInstagramGallery) return;
    
    const counter = document.getElementById('galleryCounter');
    counter.textContent = `${currentInstagramSlide + 1} / ${currentInstagramGallery.gallery.length}`;
}

// NUEVO: Cerrar galería Instagram
function closeInstagramGallery() {
    const modal = document.getElementById('instagramGalleryModal');
    
    // Quitar zoom si está activo
    const currentSlide = document.querySelector('.gallery-slide.active');
    if (currentSlide) {
        const img = currentSlide.querySelector('img');
        if (img && img.classList.contains('zoomed')) {
            img.classList.remove('zoomed');
        }
    }
    
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    currentInstagramGallery = null;
    currentInstagramSlide = 0;
}

// MOSTRAR DETALLES DEL VEHÍCULO (FUNCIÓN ORIGINAL RESTAURADA)
function showVehicleDetails(vehicleId) {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;
    
    selectedVehicle = vehicle;
    currentGalleryIndex = 0;
    
    trackEvent('view', 'Vehicle Details', vehicle.name);
    
    const modalContent = document.getElementById('vehicleDetailsContent');
    modalContent.innerHTML = `
        <div class="customization-container">
            <div class="customization-options">
                <h2 style="font-size: 28px; font-weight: 700; margin-bottom: 8px;">${vehicle.name}</h2>
                <p style="color: #86868b; margin-bottom: 24px;">${vehicle.description}</p>
                
                <div class="vehicle-gallery">
                    <div class="main-image-container">
                        <img src="${vehicle.gallery[0]}" alt="${vehicle.name}" class="main-image" id="mainGalleryImage" onclick="openInstagramGallery(${vehicle.id})">
                    </div>
                    
                    <div class="gallery-thumbnails" id="galleryThumbnails">
                        ${vehicle.gallery.map((img, index) => `
                            <img src="${img}" alt="Vista ${index + 1}" class="thumbnail ${index === 0 ? 'active' : ''}" 
                                 onclick="changeGalleryImage(${index}, ${vehicle.id})">
                        `).join('')}
                    </div>
                    
                    ${vehicle.videoId ? `
                        <div class="video-container">
                            <iframe src="https://www.youtube.com/embed/${vehicle.videoId}" 
                                    title="Video de ${vehicle.name}" 
                                    frameborder="0" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowfullscreen>
                            </iframe>
                        </div>
                    ` : ''}
                </div>
                
                <h3 style="font-size: 17px; font-weight: 600; margin-bottom: 20px;">Especificaciones Técnicas</h3>
                <div style="background: var(--gray-50); padding: 24px; border-radius: var(--radius); margin-bottom: 32px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                        ${Object.entries(vehicle.specifications).map(([key, value]) => `
                            <div style="margin-bottom: 12px;">
                                <div style="font-size: 12px; color: #86868b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                                    ${key.replace(/_/g, ' ')}
                                </div>
                                <div style="font-weight: 500;">${value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div style="display: flex; gap: 12px;">
                    <button class="button" onclick="contactVehicle(${vehicle.id}); trackEvent('click', 'Contact', '${vehicle.name}')" style="flex: 1;">
                        <i class="fab fa-whatsapp"></i> Consultar Disponibilidad
                    </button>
                    <button class="button button-outline" onclick="customizeVehicle(${vehicle.id}); trackEvent('click', 'Customize', '${vehicle.name} From Details')" style="flex: 1;">
                        <i class="fas fa-cog"></i> Personalizar
                    </button>
                </div>
            </div>
            
            <div class="customization-summary">
                <h3 style="font-size: 17px; font-weight: 600; margin-bottom: 24px;">Resumen</h3>
                
                <div style="margin-bottom: 24px;">
                    <div style="font-size: 13px; color: #86868b; margin-bottom: 8px;">Precio</div>
                    <div style="font-size: 32px; font-weight: 700;">$${formatPrice(vehicle.price)} CLP</div>
                    <div style="color: #86868b; font-size: 14px; margin-top: 4px;">${vehicle.location} • ${vehicle.eta}</div>
                </div>
                
                <div style="margin-bottom: 24px;">
                    <div class="vehicle-status ${vehicle.status === 'stock' ? 'status-badge-stock' : 'status-badge-transit'}" style="margin-bottom: 16px;">
                        ${vehicle.status === 'stock' ? 'Disponible para entrega inmediata' : 'En camino desde USA'}
                    </div>
                    
                    <div style="font-size: 14px; color: #86868b; line-height: 1.6;">
                        <div style="display: flex; align-items: center; margin-bottom: 8px;">
                            <i class="fas fa-shield-alt" style="color: var(--import-red); margin-right: 8px;"></i>
                            <span>Garantía de 6 meses</span>
                        </div>
                        <div style="display: flex; align-items: center; margin-bottom: 8px;">
                            <i class="fas fa-tools" style="color: var(--import-red); margin-right: 8px;"></i>
                            <span>Inspección completa realizada</span>
                        </div>
                        <div style="display: flex; align-items: center;">
                            <i class="fas fa-file-contract" style="color: var(--import-red); margin-right: 8px;"></i>
                            <span>Documentación en regla</span>
                        </div>
                    </div>
                </div>
                
                <div style="border-top: var(--border); padding-top: 20px;">
                    <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 12px;">Incluye</h4>
                    <div style="font-size: 14px; color: #86868b; line-height: 1.6;">
                        <div>• Revisión mecánica completa</div>
                        <div>• Limpieza y detailing profesional</div>
                        <div>• Certificado de origen USA</div>
                        <div>• Asesoría en legalización</div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('vehicleDetailsModal').style.display = 'block';
}

// Cambiar imagen de galería
function changeGalleryImage(index, vehicleId) {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;
    
    currentGalleryIndex = index;
    
    document.getElementById('mainGalleryImage').src = vehicle.gallery[index];
    
    document.querySelectorAll('#galleryThumbnails .thumbnail').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
    
    trackEvent('click', 'Gallery Thumbnail', `Image ${index + 1}`);
}

// PERSONALIZAR VEHÍCULO (FUNCIÓN ORIGINAL RESTAURADA)
function customizeVehicle(vehicleId) {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;
    
    selectedVehicle = vehicle;
    selectedKit = vehicle.kits[0];
    
    trackEvent('open', 'Customization', vehicle.name);
    
    const modalContent = document.getElementById('customizationContent');
    const isMobile = window.innerWidth <= 768;
    
    modalContent.innerHTML = `
        <div class="customization-options">
            <h2 style="font-size: 28px; font-weight: 700; margin-bottom: 8px;">Personalizar ${vehicle.name}</h2>
            <p style="color: #86868b; margin-bottom: 32px;">${vehicle.description}</p>
            
            <!-- COMPARACIÓN VISUAL -->
            ${isMobile ? `
                <div class="mobile-compact-comparison">
                    <div class="compact-image-container">
                        <div class="compact-label">Original</div>
                        <img src="${vehicle.baseImage}" alt="Vehículo base" class="comparison-image" id="mobileBaseImage">
                    </div>
                    
                    <div class="compact-image-container">
                        <div class="compact-label" id="mobileKitLabel">${selectedKit.name}</div>
                        <img src="${selectedKit.image}" alt="Vehículo personalizado" class="comparison-image" id="mobileCustomImage">
                    </div>
                </div>
            ` : `
                <div class="visual-comparison">
                    <div class="comparison-image-container">
                        <div class="comparison-label">Vehículo Base</div>
                        <img src="${vehicle.baseImage}" alt="Vehículo base" class="comparison-image" id="baseImage">
                    </div>
                    
                    <div class="comparison-image-container">
                        <div class="comparison-label">Con Kit: <span id="currentKitName">${selectedKit.name}</span></div>
                        <img src="${selectedKit.image}" alt="Vehículo personalizado" class="comparison-image" id="customizedImage">
                    </div>
                </div>
            `}
            
            <!-- PESTAÑAS DE KITS LATERALES -->
            <h3 style="font-size: 17px; font-weight: 600; margin-bottom: 20px; margin-top: ${isMobile ? '20px' : '0'};">Selecciona un Kit</h3>
            <div class="kit-tabs-container" id="kitTabsContainer">
                ${vehicle.kits.map(kit => `
                    <div class="kit-tab" 
                         onclick="selectKit('${kit.id}', '${kit.image}', '${kit.name}', '${kit.description}', ${kit.price})"
                         data-kit-id="${kit.id}">
                        <div class="kit-tab-content">
                            <div class="kit-tab-badge ${kit.level}">${kit.name}</div>
                            <div class="kit-tab-name">${kit.description.split(' - ')[0]}</div>
                        </div>
                        <div class="kit-tab-price ${kit.price === 0 ? 'included' : ''}">
                            ${kit.price > 0 ? `+$${formatPrice(kit.price)}` : 'Incluido'}
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <!-- DETALLES DE LA PERSONALIZACIÓN SELECCIONADA -->
            <div class="customization-details" id="customizationDetails">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                    <div>
                        <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Kit ${selectedKit.name}</h4>
                        <p style="font-size: 13px; color: #86868b;">${selectedKit.description}</p>
                    </div>
                    <div style="font-size: 18px; font-weight: 700; color: ${selectedKit.price > 0 ? 'var(--import-red)' : '#86868b'}">
                        ${selectedKit.price > 0 ? `+$${formatPrice(selectedKit.price)}` : 'Incluido'}
                    </div>
                </div>
                
                <div style="font-size: 13px; color: #86868b; margin-bottom: 8px;">Incluye:</div>
                <div class="customization-features" id="kitFeatures">
                    ${selectedKit.features.map(feature => `
                        <div class="customization-feature">
                            <i class="fas fa-check"></i>
                            <span>${feature}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <!-- BOTONES DE ACCIÓN -->
            <div style="display: flex; gap: 12px; margin-top: 32px; flex-direction: ${isMobile ? 'column' : 'row'}">
                <button class="button" onclick="requestCustomization(); trackEvent('click', 'Request Quote', '${vehicle.name}')" style="flex: 1;">
                    <i class="fab fa-whatsapp"></i> Solicitar Cotización
                </button>
                <button class="button button-outline" onclick="showVehicleDetails(${vehicle.id}); trackEvent('click', 'View Details', '${vehicle.name}')" style="flex: 1;">
                    <i class="fas fa-info-circle"></i> Ver Detalles del Vehículo
                </button>
            </div>
        </div>
        
        <!-- RESUMEN Y PRECIO -->
        <div class="customization-summary">
            <h3 style="font-size: 17px; font-weight: 600; margin-bottom: 24px;">Tu Configuración</h3>
            
            <div style="margin-bottom: 24px;">
                <div style="font-size: 13px; color: #86868b; margin-bottom: 8px;">Vehículo base</div>
                <div style="font-weight: 500; font-size: ${isMobile ? '15px' : 'inherit'}">${vehicle.name}</div>
                <div style="font-size: ${isMobile ? '24px' : '21px'}; font-weight: 700; margin-top: 4px; color: var(--black);">$${formatPrice(vehicle.price)} CLP</div>
            </div>
            
            <div style="margin-bottom: 24px;">
                <div style="font-size: 13px; color: #86868b; margin-bottom: 8px;">Personalización</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <div style="font-weight: 500; font-size: ${isMobile ? '15px' : 'inherit'}">Kit ${selectedKit.name}</div>
                        <div style="font-size: 12px; color: #86868b;">${selectedKit.description}</div>
                    </div>
                    <div style="font-size: ${isMobile ? '18px' : '17px'}; font-weight: 600; color: ${selectedKit.price > 0 ? 'var(--import-red)' : '#86868b'}">
                        ${selectedKit.price > 0 ? `+$${formatPrice(selectedKit.price)}` : 'Incluido'}
                    </div>
                </div>
                
                <!-- LISTA DE CARACTERÍSTICAS EN RESUMEN -->
                <div style="background: rgba(99, 11, 11, 0.05); padding: 16px; border-radius: var(--radius); margin-top: 16px;">
                    <div style="font-size: 12px; color: var(--import-red); font-weight: 500; margin-bottom: 8px;">Agregados al vehículo:</div>
                    <div style="font-size: 11px; color: var(--black); line-height: 1.5;">
                        ${selectedKit.features.slice(0, 4).map(f => `<div style="margin-bottom: 4px;">• ${f}</div>`).join('')}
                        ${selectedKit.features.length > 4 ? '<div style="color: #86868b;">+ ' + (selectedKit.features.length - 4) + ' características más</div>' : ''}
                    </div>
                </div>
            </div>
            
            <div style="border-top: var(--border); padding-top: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 600; font-size: 17px;">Total</div>
                    <div style="font-size: ${isMobile ? '28px' : '32px'}; font-weight: 700;" id="totalPrice">
                        $${formatPrice(vehicle.price + selectedKit.price)} CLP
                    </div>
                </div>
                <div style="font-size: 12px; color: #86868b; margin-top: 8px;">
                    Incluye instalación profesional y garantía de 6 meses
                </div>
            </div>
            
            <div style="margin-top: 24px; padding: 16px; border-radius: var(--radius); border: 1px dashed var(--gray-200);">
                <div style="font-size: 13px; color: #86868b; margin-bottom: 8px;">Beneficios incluidos:</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <i class="fas fa-check" style="color: var(--import-red); font-size: 10px;"></i>
                        <span>Instalación profesional</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <i class="fas fa-check" style="color: var(--import-red); font-size: 10px;"></i>
                        <span>Garantía 6 meses</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <i class="fas fa-check" style="color: var(--import-red); font-size: 10px;"></i>
                        <span>Accesorios USA</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 4px;">
                        <i class="fas fa-check" style="color: var(--import-red); font-size: 10px;"></i>
                        <span>Certificado original</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Marcar el primer kit como seleccionado
    const firstKitTab = document.querySelector(`[data-kit-id="${selectedKit.id}"]`);
    if (firstKitTab) {
        firstKitTab.classList.add('selected');
    }
    
    document.getElementById('customizationModal').style.display = 'block';
}

// SELECCIONAR KIT
function selectKit(kitId, kitImage, kitName, kitDescription, kitPrice) {
    if (!selectedVehicle) return;
    
    const kit = selectedVehicle.kits.find(k => k.id === kitId);
    if (!kit) return;
    
    selectedKit = kit;
    
    trackEvent('select', 'Kit', kitName);
    
    // Actualizar pestañas
    document.querySelectorAll('#kitTabsContainer .kit-tab').forEach(item => {
        item.classList.remove('selected');
        if (item.getAttribute('data-kit-id') === kitId) {
            item.classList.add('selected');
        }
    });
    
    // Actualizar imagen personalizada
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        const mobileCustomImage = document.getElementById('mobileCustomImage');
        const mobileKitLabel = document.getElementById('mobileKitLabel');
        
        if (mobileCustomImage) {
            mobileCustomImage.src = kitImage;
        }
        
        if (mobileKitLabel) {
            mobileKitLabel.textContent = kitName;
        }
    } else {
        const customizedImage = document.getElementById('customizedImage');
        const currentKitName = document.getElementById('currentKitName');
        
        if (customizedImage) {
            customizedImage.src = kitImage;
        }
        
        if (currentKitName) {
            currentKitName.textContent = kitName;
        }
    }
    
    // Actualizar sección de detalles
    updateCustomizationDetails();
    
    // Actualizar precio
    updateTotalPrice();
}

// Actualizar detalles de personalización
function updateCustomizationDetails() {
    if (!selectedKit) return;
    
    const detailsContainer = document.getElementById('customizationDetails');
    if (!detailsContainer) return;
    
    detailsContainer.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
            <div>
                <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Kit ${selectedKit.name}</h4>
                <p style="font-size: 13px; color: #86868b;">${selectedKit.description}</p>
            </div>
            <div style="font-size: 18px; font-weight: 700; color: ${selectedKit.price > 0 ? 'var(--import-red)' : '#86868b'}">
                ${selectedKit.price > 0 ? `+$${formatPrice(selectedKit.price)}` : 'Incluido'}
            </div>
        </div>
        
        <div style="font-size: 13px; color: #86868b; margin-bottom: 8px;">Incluye:</div>
        <div class="customization-features">
            ${selectedKit.features.map(feature => `
                <div class="customization-feature">
                    <i class="fas fa-check"></i>
                    <span>${feature}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// Actualizar precio total
function updateTotalPrice() {
    if (!selectedVehicle || !selectedKit) return;
    
    const totalElement = document.getElementById('totalPrice');
    if (!totalElement) return;
    
    const total = selectedVehicle.price + selectedKit.price;
    const isMobile = window.innerWidth <= 768;
    
    totalElement.textContent = `$${formatPrice(total)} CLP`;
    totalElement.style.fontSize = isMobile ? '28px' : '32px';
}

// Mostrar modal de personalización
function showCustomizationModal() {
    const modalContent = document.getElementById('customizationContent');
    modalContent.innerHTML = `
        <div class="customization-options">
            <h2 style="font-size: 28px; font-weight: 700; margin-bottom: 8px;">Simular Personalización</h2>
            <p style="color: #86868b; margin-bottom: 32px;">Selecciona un vehículo para comenzar</p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                ${vehicles.slice(0, 3).map(vehicle => `
                    <div onclick="customizeVehicle(${vehicle.id})" style="cursor: pointer; border: var(--border); border-radius: var(--radius); padding: 20px; text-align: center;">
                        <img src="${vehicle.baseImage}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; margin-bottom: 12px;">
                        <div style="font-weight: 500; margin-bottom: 4px;">${vehicle.name}</div>
                        <div style="font-size: 14px; color: #86868b; margin-bottom: 8px;">${vehicle.description.split('•')[0]}</div>
                        <div style="font-size: 17px; font-weight: 600;">$${formatPrice(vehicle.price)} CLP</div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="customization-summary">
            <h3 style="font-size: 17px; font-weight: 600; margin-bottom: 16px;">Beneficios</h3>
            <div style="color: #86868b; font-size: 14px; line-height: 1.8;">
                <div style="display: flex; align-items: start; margin-bottom: 16px;">
                    <i class="fas fa-check" style="color: var(--import-red); margin-right: 12px; margin-top: 4px;"></i>
                    <span>Accesorios USA originales</span>
                </div>
                <div style="display: flex; align-items: start; margin-bottom: 16px;">
                    <i class="fas fa-check" style="color: var(--import-red); margin-right: 12px; margin-top: 4px;"></i>
                    <span>Instalación profesional en Arica</span>
                </div>
                <div style="display: flex; align-items: start; margin-bottom: 16px;">
                    <i class="fas fa-check" style="color: var(--import-red); margin-right: 12px; margin-top: 4px;"></i>
                    <span>Garantía de 6 meses</span>
                </div>
                <div style="display: flex; align-items: start;">
                    <i class="fas fa-check" style="color: var(--import-red); margin-right: 12px; margin-top: 4px;"></i>
                    <span>Precio todo incluido</span>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('customizationModal').style.display = 'block';
}

// Contactar por vehículo
function contactVehicle(vehicleId) {
    let vehicle;
    if (vehicleId === 0) {
        // Contacto general
        vehicle = { name: "Asesoría Personalizada", price: 0, status: "stock" };
    } else {
        vehicle = vehicles.find(v => v.id === vehicleId);
    }
    
    if (!vehicle) return;
    
    let message;
    if (vehicleId === 0) {
        message = `Hola, estoy interesado en recibir asesoría personalizada para importar un vehículo desde USA. ¿Podrían contactarme para conversar sobre mis necesidades?`;
    } else {
        message = `Hola, estoy interesado en el vehículo: ${vehicle.name} ${vehicle.price > 0 ? `($${formatPrice(vehicle.price)} CLP)` : ''}. Estado: ${vehicle.status === 'stock' ? 'En Stock Arica' : 'En Tránsito'}. ¿Podrían darme más información?`;
    }
    
    trackEvent('contact', 'WhatsApp', vehicle.name);
    window.open(`https://wa.me/56938654827?text=${encodeURIComponent(message)}`, '_blank');
}

// Solicitar cotización de personalización
function requestCustomization() {
    if (!selectedVehicle || !selectedKit) return;
    
    const total = selectedVehicle.price + selectedKit.price;
    
    const message = `Hola, quisiera cotizar esta configuración personalizada:%0A%0A🚗 *Vehículo:* ${selectedVehicle.name}%0A💰 *Precio base:* $${formatPrice(selectedVehicle.price)} CLP%0A%0A⚙️ *Kit seleccionado:* ${selectedKit.name}%0A📋 *Descripción:* ${selectedKit.description}%0A🔧 *Incluye:* ${selectedKit.features.join(', ')}%0A💵 *Valor kit:* $${formatPrice(selectedKit.price)} CLP%0A%0A💵 *TOTAL CONFIGURACIÓN:* $${formatPrice(total)} CLP%0A%0A¿Podemos proceder con esta configuración?`;
    
    trackEvent('request', 'Customization Quote', `${selectedVehicle.name} - ${selectedKit.name}`);
    window.open(`https://wa.me/56938654827?text=${encodeURIComponent(message)}`, '_blank');
}

// Cerrar modal de detalles
function closeVehicleDetailsModal() {
    document.getElementById('vehicleDetailsModal').style.display = 'none';
    selectedVehicle = null;
    currentGalleryIndex = 0;
}

// Cerrar modal de personalización
function closeCustomizationModal() {
    document.getElementById('customizationModal').style.display = 'none';
    selectedVehicle = null;
    selectedKit = null;
}

// Cerrar modales con ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeVehicleDetailsModal();
        closeCustomizationModal();
        closeInstagramGallery();
    }
});

// Cerrar modales al hacer click fuera
document.getElementById('vehicleDetailsModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('vehicleDetailsModal')) {
        closeVehicleDetailsModal();
    }
});

document.getElementById('customizationModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('customizationModal')) {
        closeCustomizationModal();
    }
});

document.getElementById('instagramGalleryModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('instagramGalleryModal')) {
        closeInstagramGallery();
    }
});

// Track scroll depth para Google Analytics
let scrollTracked25 = false;
let scrollTracked50 = false;
let scrollTracked75 = false;
let scrollTracked100 = false;

window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    const scrollPercent = (scrollTop / (docHeight - windowHeight)) * 100;
    
    if (scrollPercent >= 25 && !scrollTracked25) {
        trackEvent('scroll', 'Engagement', '25%');
        scrollTracked25 = true;
    }
    if (scrollPercent >= 50 && !scrollTracked50) {
        trackEvent('scroll', 'Engagement', '50%');
        scrollTracked50 = true;
    }
    if (scrollPercent >= 75 && !scrollTracked75) {
        trackEvent('scroll', 'Engagement', '75%');
        scrollTracked75 = true;
    }
    if (scrollPercent >= 95 && !scrollTracked100) {
        trackEvent('scroll', 'Engagement', '100%');
        scrollTracked100 = true;
    }
});

// Track tiempo en página
let pageLoadTime = Date.now();
window.addEventListener('beforeunload', () => {
    const timeOnPage = Math.round((Date.now() - pageLoadTime) / 1000);
    trackEvent('time', 'Engagement', `${timeOnPage}s`);
});
