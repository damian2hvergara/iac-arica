/* ========================================
   vehicles.js - Lógica de Vehículos
   VERSIÓN FUSIONADA:
   - Estructura simple del proyecto anterior
   - Kits, share, deep link del proyecto nuevo
   - Specifications seguro contra null
   ======================================== */

let currentVehicles = [];
let selectedVehicle = null;

// ====================================
// INICIALIZACIÓN
// ====================================
async function initializeApp() {
    try {
        vehicleAPI.init();
        console.log('✅ App inicializada');
    } catch (error) {
        console.error('❌ Error:', error);
        showError('Error al conectar con la base de datos');
    }
}

// ====================================
// CARGAR VEHÍCULOS
// ====================================
async function loadVehicles() {
    const container  = document.getElementById('vehiclesContainer');
    const spinner    = document.getElementById('loadingSpinner');
    const emptyState = document.getElementById('emptyState');

    try {
        if (spinner)    spinner.style.display = 'flex';
        if (container)  container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'none';

        // Siempre cargamos todos — el filtro doble opera en el cliente
        currentVehicles = await vehicleAPI.getAllVehicles();

        if (spinner) spinner.style.display = 'none';

        if (currentVehicles.length === 0) {
            if (emptyState) emptyState.style.display = 'block';
            return;
        }

        // Pasar al sistema de filtros (renderiza la primera vez también)
        filterSystem.init(currentVehicles);

        handleDeepLink();
        await updateStockCounters();

    } catch (error) {
        console.error('Error al cargar vehículos:', error);
        if (spinner)    spinner.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        showError('Error al cargar vehículos');
    }
}

// ====================================
// RENDERIZAR TARJETAS
// ====================================
function renderVehicles(vehicles) {
    const container = document.getElementById('vehiclesContainer');
    if (!container) return;

    container.innerHTML = vehicles.map(vehicle => {
        const statusConfig = APP_CONFIG.vehicleStatuses[vehicle.status] || APP_CONFIG.vehicleStatuses.stock;
        const hasKits = vehicle.kits && vehicle.kits.length > 0;

        return `
        <div class="vehicle-card">
            <div style="position: relative;">
                <img src="${vehicle.baseImage}"
                     alt="${vehicle.name}"
                     class="vehicle-image"
                     onclick="openGallery('${vehicle.id}')"
                     loading="lazy"
                     onerror="this.src='https://res.cloudinary.com/df2gprqhp/image/upload/v1765988412/CHEVROLET_yjwbxt.jpg'">

                ${hasKits ? `
                <div style="position:absolute;top:12px;right:12px;background:linear-gradient(135deg,var(--import-red) 0%,#8b0707 100%);color:white;padding:8px 14px;border-radius:20px;font-size:11px;font-weight:700;box-shadow:0 4px 12px rgba(99,11,11,0.4);display:flex;align-items:center;gap:6px;z-index:5;">
                    <i class="fas fa-star" style="font-size:10px;"></i>
                    ${vehicle.kits.length} Kit${vehicle.kits.length > 1 ? 's' : ''}
                </div>` : ''}

                <button onclick="shareVehicle('${vehicle.id}', this)" class="share-btn-premium">
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

                ${hasKits ? `
                <div style="margin:12px 0;padding:12px;background:var(--gray-50);border-radius:8px;border-left:3px solid var(--import-red);">
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:var(--import-red);margin-bottom:8px;">
                        <i class="fas fa-magic" style="font-size:10px;"></i> Personalización Disponible
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;">
                        ${vehicle.kits.slice(0, 2).map(kit =>
                            `<span style="font-size:11px;padding:4px 10px;background:var(--white);border-radius:12px;border:1px solid var(--gray-200);font-weight:500;">${kit.name}</span>`
                        ).join('')}
                        ${vehicle.kits.length > 2 ? `<span style="font-size:11px;padding:4px 10px;color:var(--gray-300);font-weight:500;">+${vehicle.kits.length - 2} más</span>` : ''}
                    </div>
                </div>` : ''}

                ${vehicle.status === 'transit' && vehicle.transit_time ? `
                <div class="transit-timer">
                    <div class="timer-icon"><i class="fas fa-shipping-fast"></i></div>
                    <div>
                        <div class="timer-text">Llega en</div>
                        <div class="timer-display">${vehicle.transit_time} días</div>
                    </div>
                </div>` : ''}

                <div class="vehicle-actions" style="display:grid;grid-template-columns:${hasKits ? '1fr 1fr 1fr' : '1fr 1fr'};gap:8px;margin-top:12px;">
                    ${hasKits ? `
                    <button class="button" onclick="openCustomization('${vehicle.id}')" style="background:linear-gradient(135deg,var(--import-red) 0%,#8b0707 100%);font-size:13px;padding:10px 12px;">
                        <i class="fas fa-magic"></i> Personalizar
                    </button>` : ''}
                    <button class="button ${hasKits ? 'button-outline' : ''}" onclick="showVehicleDetails('${vehicle.id}')" style="font-size:13px;padding:10px 12px;">
                        <i class="fas fa-info-circle"></i> Detalles
                    </button>
                    <button class="button button-outline" onclick="openConsultation('${vehicle.id}')" style="font-size:13px;padding:10px 12px;">
                        <i class="fas fa-question-circle"></i> Consultas
                    </button>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ====================================
// MODAL DE DETALLES
// ====================================
async function showVehicleDetails(vehicleId) {
    try {
        const vehicle = await vehicleAPI.getVehicle(vehicleId);
        selectedVehicle = vehicle;

        const modal   = document.getElementById('vehicleDetailsModal');
        const content = document.getElementById('vehicleDetailsContent');
        if (!modal || !content) return;

        trackEvent('view', 'Vehicle Details', vehicle.name);
        const hasKits = vehicle.kits && vehicle.kits.length > 0;

        content.innerHTML = `
        <div style="padding:32px;">
            <h2 style="font-size:28px;font-weight:700;margin-bottom:8px;">${vehicle.name}</h2>
            <p style="color:var(--gray-300);margin-bottom:24px;">${vehicle.description || ''}</p>

            <!-- Galería de imágenes -->
            <div style="margin-bottom:32px;">
                <div style="position:relative;border-radius:var(--radius);overflow:hidden;border:var(--border);height:400px;margin-bottom:16px;cursor:pointer;" onclick="openGallery('${vehicle.id}')">
                    <img src="${vehicle.gallery[0] || vehicle.baseImage}" alt="${vehicle.name}"
                         style="width:100%;height:100%;object-fit:cover;" id="mainDetailImage"
                         onerror="this.src='${vehicle.baseImage}'">
                    <div style="position:absolute;bottom:12px;right:12px;background:rgba(0,0,0,0.6);color:white;padding:6px 12px;border-radius:20px;font-size:12px;">
                        <i class="fas fa-images"></i> Ver galería (${vehicle.gallery.length})
                    </div>
                </div>
                ${vehicle.gallery.length > 1 ? `
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px;">
                    ${vehicle.gallery.map((img, i) => `
                    <img src="${img}" alt="Vista ${i+1}"
                         style="width:100%;height:80px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid ${i === 0 ? 'var(--import-red)' : 'transparent'};"
                         onclick="changeDetailImage('${img}', this)"
                         onerror="this.style.display='none'">
                    `).join('')}
                </div>` : ''}
            </div>

            <!-- Kits disponibles -->
            ${hasKits ? `
            <div style="background:var(--import-red-light);padding:24px;border-radius:12px;margin-bottom:24px;border:1px solid rgba(99,11,11,0.2);">
                <h3 style="font-size:17px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:10px;">
                    <i class="fas fa-magic" style="color:var(--import-red);"></i>
                    ${vehicle.kits.length} Kit${vehicle.kits.length > 1 ? 's' : ''} de Personalización
                </h3>
                <div style="display:grid;gap:12px;">
                    ${vehicle.kits.map(kit => `
                    <div style="background:white;padding:16px;border-radius:8px;border:1px solid var(--gray-200);">
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                            <div>
                                <div style="font-size:15px;font-weight:600;">${kit.name}</div>
                                <div style="font-size:13px;color:var(--gray-300);">${kit.description || ''}</div>
                            </div>
                            <div style="font-size:17px;font-weight:700;color:${kit.price > 0 ? 'var(--import-red)' : 'var(--gray-300)'};white-space:nowrap;margin-left:12px;">
                                ${kit.price > 0 ? '+$' + formatPrice(kit.price) : 'Incluido'}
                            </div>
                        </div>
                        ${kit.features && kit.features.length > 0 ? `
                        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px;margin-top:8px;">
                            ${kit.features.map(f => `
                            <div style="display:flex;align-items:center;gap:6px;font-size:13px;">
                                <i class="fas fa-check" style="color:var(--import-red);font-size:11px;"></i> ${f}
                            </div>`).join('')}
                        </div>` : ''}
                    </div>`).join('')}
                </div>
            </div>` : ''}

            <!-- Especificaciones técnicas -->
            ${vehicle.hasSpecs ? `
            <h3 style="font-size:17px;font-weight:600;margin-bottom:16px;">Especificaciones Técnicas</h3>
            <div style="background:var(--gray-50);padding:24px;border-radius:var(--radius);margin-bottom:24px;">
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;">
                    ${Object.entries(vehicle.specifications).filter(([_, v]) => v).map(([key, val]) => `
                    <div>
                        <div style="font-size:12px;color:var(--gray-300);text-transform:uppercase;margin-bottom:4px;">${key}</div>
                        <div style="font-weight:500;">${val}</div>
                    </div>`).join('')}
                </div>
            </div>` : ''}

            <!-- Precio y acciones -->
            <div style="background:var(--gray-50);padding:24px;border-radius:var(--radius);margin-bottom:24px;">
                <div style="font-size:13px;color:var(--gray-300);margin-bottom:4px;">Precio</div>
                <div style="font-size:32px;font-weight:700;">$${formatPrice(vehicle.price)} CLP</div>
                ${vehicle.location ? `<div style="color:var(--gray-300);font-size:14px;margin-top:4px;">${vehicle.location}</div>` : ''}
            </div>

            <div style="display:flex;gap:12px;flex-wrap:wrap;">
                <button class="button" onclick="contactVehicle('${vehicle.id}')" style="flex:1;min-width:180px;">
                    <i class="fab fa-whatsapp"></i> Consultar
                </button>
                ${hasKits ? `
                <button class="button button-outline" onclick="closeVehicleDetails(); openCustomization('${vehicle.id}')" style="flex:1;min-width:180px;">
                    <i class="fas fa-magic"></i> Personalizar
                </button>` : ''}
            </div>
        </div>`;

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

    } catch (error) {
        console.error('Error al cargar detalles:', error);
        showError('Error al cargar detalles del vehículo');
    }
}

function changeDetailImage(imageUrl, el) {
    const mainImage = document.getElementById('mainDetailImage');
    if (mainImage) mainImage.src = imageUrl;
    el.parentElement.querySelectorAll('img').forEach(img => {
        img.style.borderColor = img === el ? 'var(--import-red)' : 'transparent';
    });
}

function closeVehicleDetails() {
    const modal = document.getElementById('vehicleDetailsModal');
    if (modal) { modal.classList.remove('active'); document.body.style.overflow = 'auto'; }
    selectedVehicle = null;
}

// ====================================
// CONTACTAR POR WHATSAPP
// ====================================
function contactVehicle(vehicleId) {
    const vehicle = currentVehicles.find(v => v.id === vehicleId) || selectedVehicle;
    if (!vehicle) return;
    const statusLabel = APP_CONFIG.vehicleStatuses[vehicle.status]?.label || vehicle.status;
    const message = `Hola, estoy interesado en ${vehicle.name} ($${formatPrice(vehicle.price)} CLP). Estado: ${statusLabel}. ¿Más información?`;
    trackEvent('contact', 'WhatsApp', vehicle.name);
    window.open(`https://wa.me/${CONTACT_CONFIG.whatsapp}?text=${encodeURIComponent(message)}`, '_blank');
}

// ====================================
// COMPARTIR VEHÍCULO
// ====================================
function shareVehicle(vehicleId, buttonEl = null) {
    const vehicle = currentVehicles.find(v => v.id === vehicleId) || selectedVehicle;
    if (!vehicle) return;

    if (!vehicle.shareCount) vehicle.shareCount = 0;
    vehicle.shareCount++;

    if (buttonEl) {
        const counter = buttonEl.querySelector('.share-count');
        if (counter) counter.textContent = vehicle.shareCount;
        buttonEl.classList.add('share-animate');
        setTimeout(() => buttonEl.classList.remove('share-animate'), 400);
    }

    const vehicleUrl = `${window.location.origin}${window.location.pathname}?v=${vehicle.id}`;
    const message = `Mira esta ${vehicle.name} disponible en Arica por $${formatPrice(vehicle.price)} CLP:\n${vehicleUrl}`;

    trackEvent('share', 'Vehicle', vehicle.name);

    if (navigator.share) {
        navigator.share({ title: vehicle.name, text: message, url: vehicleUrl }).catch(() => {});
    } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
}

// ====================================
// DEEP LINK ?v=ID
// ====================================
function handleDeepLink() {
    const vehicleId = new URLSearchParams(window.location.search).get('v');
    if (!vehicleId) return;
    setTimeout(() => {
        const img = document.querySelector(`[onclick="openGallery('${vehicleId}')"]`);
        const card = img?.closest('.vehicle-card');
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.boxShadow = '0 0 0 3px var(--import-red)';
            setTimeout(() => card.style.boxShadow = '', 2000);
        }
        showVehicleDetails(vehicleId);
    }, 800);
}

// ====================================
// CONTADORES DE STOCK
// ====================================
async function updateStockCounters() {
    try {
        const stats = await vehicleAPI.getStats();
        const stockCount   = document.getElementById('stockCount');
        const transitCount = document.getElementById('transitCount');
        const reserveCount = document.getElementById('reserveCount');
        if (stockCount)   stockCount.textContent   = stats.stock;
        if (transitCount) transitCount.textContent = stats.transit;
        if (reserveCount) reserveCount.textContent = stats.reserve;
    } catch (error) {
        console.error('Error actualizando contadores:', error);
    }
}

// ====================================
// ANIMACIÓN CONTADOR HERO
// ====================================
function animateCounter() {
    const el = document.getElementById('importedVehiclesCounter');
    if (!el) return;
    const target = APP_CONFIG.importedVehiclesCount;
    let current = 0;
    const steps = 60;
    const increment = target / steps;
    let step = 0;
    const timer = setInterval(() => {
        step++;
        current = Math.min(Math.floor(increment * step), target);
        el.textContent = current;
        if (step >= steps) { clearInterval(timer); el.textContent = target; }
    }, 2000 / steps);
}

// ====================================
// EVENT LISTENERS
// ====================================
function setupEventListeners() {
    // Indicadores de stock en el hero → scroll a vehículos
    document.querySelectorAll('.stock-indicators .indicator').forEach(ind => {
        ind.addEventListener('click', function () {
            const filter = this.getAttribute('data-filter');
            if (filter && typeof filterSystem !== 'undefined') {
                filterSystem.currentStatus = filter;
                filterSystem._apply();
                filterSystem._updateActive();
            }
            scrollToElement('vehicles');
        });
    });

    // Botón WhatsApp footer
    const waBtn = document.getElementById('whatsappBtn');
    if (waBtn) {
        waBtn.addEventListener('click', e => {
            e.preventDefault();
            const msg = 'Hola, estoy interesado en recibir asesoría para importar un vehículo desde USA.';
            trackEvent('click', 'Contact', 'WhatsApp Footer');
            window.open(`https://wa.me/${CONTACT_CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`, '_blank');
        });
    }

    // ESC cierra modales
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeVehicleDetails();
            if (typeof closeCustomization === 'function')  closeCustomization();
            if (typeof closeGallery       === 'function')  closeGallery();
            if (typeof closeConsultation  === 'function')  closeConsultation();
        }
    });

    // Overlay cierra modal de detalles
    const detailsModal = document.getElementById('vehicleDetailsModal');
    if (detailsModal) {
        detailsModal.addEventListener('click', e => {
            if (e.target.classList.contains('modal-overlay')) closeVehicleDetails();
        });
    }

    // Tracking de scroll
    let scrollTracked = { 25: false, 50: false, 75: false, 100: false };
    window.addEventListener('scroll', throttle(() => {
        const pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
        Object.keys(scrollTracked).forEach(p => {
            if (pct >= parseInt(p) && !scrollTracked[p]) {
                trackEvent('scroll', 'Engagement', `${p}%`);
                scrollTracked[p] = true;
            }
        });
    }, 1000));
}

console.log('✅ Vehicles.js cargado - Versión fusionada');
