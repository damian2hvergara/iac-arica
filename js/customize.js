// Personalización de vehículos (TU CÓDIGO ORIGINAL)

function showVehicleDetails(vehicleId) {
    const vehicle = DataLoader.getVehicleById(vehicleId);
    if (!vehicle) {
        console.error('Vehículo no encontrado');
        return;
    }
    
    selectedVehicle = vehicle;
    currentGalleryIndex = 0;
    
    trackEvent('view', 'Vehicle Details', vehicle.name);
    
    const modalContent = document.getElementById('vehicleDetailsContent');
    if (!modalContent) return;
    
    // Validar datos
    const hasGallery = vehicle.gallery && vehicle.gallery.length > 0;
    const hasSpecs = vehicle.specifications && Object.keys(vehicle.specifications).length > 0;
    const hasVideo = vehicle.videoId;
    
    modalContent.innerHTML = `
        <div class="customization-container">
            <div class="customization-options">
                <h2 style="font-size: 28px; font-weight: 700; margin-bottom: 8px;">${vehicle.name}</h2>
                <p style="color: #86868b; margin-bottom: 24px;">${vehicle.description}</p>
                
                ${hasGallery ? `
                <div class="vehicle-gallery">
                    <div class="main-image-container">
                        <img src="${vehicle.gallery[0]}" alt="${vehicle.name}" class="main-image" id="mainGalleryImage" 
                             onclick="${vehicle.gallery.length > 1 ? `openInstagramGallery(${vehicle.id})` : ''}">
                    </div>
                    
                    ${vehicle.gallery.length > 1 ? `
                    <div class="gallery-thumbnails" id="galleryThumbnails">
                        ${vehicle.gallery.map((img, index) => 
                            `<img src="${img}" alt="Vista ${index + 1}" class="thumbnail ${index === 0 ? 'active' : ''}" 
                                 onclick="changeGalleryImage(${index}, ${vehicle.id})">`
                        ).join('')}
                    </div>
                    ` : ''}
                    
                    ${hasVideo ? `
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
                ` : `
                <div style="text-align: center; padding: 40px; background: var(--gray-50); border-radius: var(--radius);">
                    <div style="font-size: 48px; margin-bottom: 16px;">📷</div>
                    <p style="color: #86868b;">Próximamente más imágenes de este vehículo</p>
                </div>
                `}
                
                ${hasSpecs ? `
                <h3 style="font-size: 17px; font-weight: 600; margin-bottom: 20px; margin-top: 32px;">Especificaciones Técnicas</h3>
                <div style="background: var(--gray-50); padding: 24px; border-radius: var(--radius); margin-bottom: 32px;">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                        ${Object.entries(vehicle.specifications).map(([key, value]) => 
                            `<div style="margin-bottom: 12px;">
                                <div style="font-size: 12px; color: #86868b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                                    ${key.replace(/_/g, ' ')}
                                </div>
                                <div style="font-weight: 500;">${value}</div>
                            </div>`
                        ).join('')}
                    </div>
                </div>
                ` : ''}
                
                <div style="display: flex; gap: 12px; margin-top: ${hasSpecs ? '0' : '32px'};">
                    <button class="button" onclick="contactVehicle(${vehicle.id})" style="flex: 1;">
                        <i class="fab fa-whatsapp"></i> Consultar Disponibilidad
                    </button>
                    ${vehicle.kits && vehicle.kits.length > 0 ? `
                    <button class="button button-outline" onclick="customizeVehicle(${vehicle.id})" style="flex: 1;">
                        <i class="fas fa-cog"></i> Personalizar
                    </button>
                    ` : ''}
                </div>
            </div>
            
            <div class="customization-summary">
                <h3 style="font-size: 17px; font-weight: 600; margin-bottom: 24px;">Resumen</h3>
                
                <div style="margin-bottom: 24px;">
                    <div style="font-size: 13px; color: #86868b; margin-bottom: 8px;">Precio</div>
                    <div style="font-size: 32px; font-weight: 700;">${CONFIG.formatPrice(vehicle.price)} CLP</div>
                    <div style="color: #86868b; font-size: 14px; margin-top: 4px;">${vehicle.location} • ${vehicle.eta || 'Consultar'}</div>
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

function changeGalleryImage(index, vehicleId) {
    const vehicle = DataLoader.getVehicleById(vehicleId);
    if (!vehicle || !vehicle.gallery) return;
    
    currentGalleryIndex = index;
    
    const mainImage = document.getElementById('mainGalleryImage');
    if (mainImage && vehicle.gallery[index]) {
        mainImage.src = vehicle.gallery[index];
    }
    
    document.querySelectorAll('#galleryThumbnails .thumbnail').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
    
    trackEvent('click', 'Gallery Thumbnail', `Image ${index + 1}`);
}

function customizeVehicle(vehicleId) {
    const vehicle = DataLoader.getVehicleById(vehicleId);
    if (!vehicle || !vehicle.kits || vehicle.kits.length === 0) {
        alert('Este vehículo no tiene opciones de personalización disponibles.');
        return;
    }
    
    selectedVehicle = vehicle;
    selectedKit = vehicle.kits[0];
    
    trackEvent('open', 'Customization', vehicle.name);
    
    const modalContent = document.getElementById('customizationContent');
    if (!modalContent) return;
    
    const isMobile = window.innerWidth <= 768;
    
    modalContent.innerHTML = `
        <div class="customization-options">
            <h2 style="font-size: 28px; font-weight: 700; margin-bottom: 8px;">Personalizar ${vehicle.name}</h2>
            <p style="color: #86868b; margin-bottom: 32px;">${vehicle.description}</p>
            
            <!-- COMPARACIÓN VISUAL -->
            ${vehicle.kits.length > 0 ? `
            ${isMobile ? 
                `<div class="mobile-compact-comparison">
                    <div class="compact-image-container">
                        <div class="compact-label">Original</div>
                        <img src="${vehicle.baseImage}" alt="Vehículo base" class="comparison-image" id="mobileBaseImage">
                    </div>
                    
                    <div class="compact-image-container">
                        <div class="compact-label" id="mobileKitLabel">${selectedKit.name}</div>
                        <img src="${selectedKit.image}" alt="Vehículo personalizado" class="comparison-image" id="mobileCustomImage">
                    </div>
                </div>`
             : 
                `<div class="visual-comparison">
                    <div class="comparison-image-container">
                        <div class="comparison-label">Vehículo Base</div>
                        <img src="${vehicle.baseImage}" alt="Vehículo base" class="comparison-image" id="baseImage">
                    </div>
                    
                    <div class="comparison-image-container">
                        <div class="comparison-label">Con Kit: <span id="currentKitName">${selectedKit.name}</span></div>
                        <img src="${selectedKit.image}" alt="Vehículo personalizado" class="comparison-image" id="customizedImage">
                    </div>
                </div>`
            }
            ` : ''}
            
            <!-- PESTAÑAS DE KITS -->
            ${vehicle.kits.length > 0 ? `
            <h3 style="font-size: 17px; font-weight: 600; margin-bottom: 20px; margin-top: ${isMobile ? '20px' : '0'};">Selecciona un Kit</h3>
            <div class="kit-tabs-container" id="kitTabsContainer">
                ${vehicle.kits.map(kit => 
                    `<div class="kit-tab" 
                         onclick="selectKit('${kit.id}', '${kit.image}', '${kit.name}', '${kit.description}', ${kit.price})"
                         data-kit-id="${kit.id}">
                        <div class="kit-tab-content">
                            <div class="kit-tab-badge ${kit.level}">${kit.name}</div>
                            <div class="kit-tab-name">${kit.description.split(' - ')[0]}</div>
                        </div>
                        <div class="kit-tab-price ${kit.price === 0 ? 'included' : ''}">
                            ${kit.price > 0 ? `+${CONFIG.formatPrice(kit.price)}` : 'Incluido'}
                        </div>
                    </div>`
                ).join('')}
            </div>
            
            <!-- DETALLES -->
            <div class="customization-details" id="customizationDetails">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                    <div>
                        <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Kit ${selectedKit.name}</h4>
                        <p style="font-size: 13px; color: #86868b;">${selectedKit.description}</p>
                    </div>
                    <div style="font-size: 18px; font-weight: 700; color: ${selectedKit.price > 0 ? 'var(--import-red)' : '#86868b'}">
                        ${selectedKit.price > 0 ? `+${CONFIG.formatPrice(selectedKit.price)}` : 'Incluido'}
                    </div>
                </div>
                
                <div style="font-size: 13px; color: #86868b; margin-bottom: 8px;">Incluye:</div>
                <div class="customization-features" id="kitFeatures">
                    ${selectedKit.features.map(feature => 
                        `<div class="customization-feature">
                            <i class="fas fa-check"></i>
                            <span>${feature}</span>
                        </div>`
                    ).join('')}
                </div>
            </div>
            ` : 
            `<div style="text-align: center; padding: 40px; background: var(--gray-50); border-radius: var(--radius);">
                <div style="font-size: 48px; margin-bottom: 16px;">⚙️</div>
                <h4 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">Personalización no disponible</h4>
                <p style="color: #86868b;">Este vehículo no tiene kits de personalización configurados.</p>
            </div>`
            }
            
            <!-- BOTONES -->
            <div style="display: flex; gap: 12px; margin-top: 32px; flex-direction: ${isMobile ? 'column' : 'row'}">
                <button class="button" onclick="requestCustomization()" style="flex: 1;">
                    <i class="fab fa-whatsapp"></i> Solicitar Cotización
                </button>
                <button class="button button-outline" onclick="showVehicleDetails(${vehicle.id})" style="flex: 1;">
                    <i class="fas fa-info-circle"></i> Ver Detalles del Vehículo
                </button>
            </div>
        </div>
        
        <!-- RESUMEN -->
        <div class="customization-summary">
            <h3 style="font-size: 17px; font-weight: 600; margin-bottom: 24px;">Tu Configuración</h3>
            
            <div style="margin-bottom: 24px;">
                <div style="font-size: 13px; color: #86868b; margin-bottom: 8px;">Vehículo base</div>
                <div style="font-weight: 500; font-size: ${isMobile ? '15px' : 'inherit'}">${vehicle.name}</div>
                <div style="font-size: ${isMobile ? '24px' : '21px'}; font-weight: 700; margin-top: 4px;">${CONFIG.formatPrice(vehicle.price)} CLP</div>
            </div>
            
            ${selectedKit ? `
            <div style="margin-bottom: 24px;">
                <div style="font-size: 13px; color: #86868b; margin-bottom: 8px;">Personalización</div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <div>
                        <div style="font-weight: 500; font-size: ${isMobile ? '15px' : 'inherit'}">Kit ${selectedKit.name}</div>
                        <div style="font-size: 12px; color: #86868b;">${selectedKit.description}</div>
                    </div>
                    <div style="font-size: ${isMobile ? '18px' : '17px'}; font-weight: 600; color: ${selectedKit.price > 0 ? 'var(--import-red)' : '#86868b'}">
                        ${selectedKit.price > 0 ? `+${CONFIG.formatPrice(selectedKit.price)}` : 'Incluido'}
                    </div>
                </div>
                
                ${selectedKit.features && selectedKit.features.length > 0 ? `
                <div style="background: rgba(99, 11, 11, 0.05); padding: 16px; border-radius: var(--radius); margin-top: 16px;">
                    <div style="font-size: 12px; color: var(--import-red); font-weight: 500; margin-bottom: 8px;">Agregados al vehículo:</div>
                    <div style="font-size: 11px; color: var(--black); line-height: 1.5;">
                        ${selectedKit.features.slice(0, 4).map(f => `<div style="margin-bottom: 4px;">• ${f}</div>`).join('')}
                        ${selectedKit.features.length > 4 ? `<div style="color: #86868b;">+ ${selectedKit.features.length - 4} características más</div>` : ''}
                    </div>
                </div>
                ` : ''}
            </div>
            ` : ''}
            
            <div style="border-top: var(--border); padding-top: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 600; font-size: 17px;">Total</div>
                    <div style="font-size: ${isMobile ? '28px' : '32px'}; font-weight: 700;" id="totalPrice">
                        ${CONFIG.formatPrice(vehicle.price + (selectedKit?.price || 0))} CLP
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
    
    // Marcar primer kit como seleccionado
    if (vehicle.kits.length > 0) {
        const firstKitTab = document.querySelector(`[data-kit-id="${selectedKit.id}"]`);
        if (firstKitTab) {
            firstKitTab.classList.add('selected');
        }
    }
    
    document.getElementById('customizationModal').style.display = 'block';
}

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
    
    // Actualizar imagen
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        const mobileCustomImage = document.getElementById('mobileCustomImage');
        const mobileKitLabel = document.getElementById('mobileKitLabel');
        
        if (mobileCustomImage) mobileCustomImage.src = kitImage;
        if (mobileKitLabel) mobileKitLabel.textContent = kitName;
    } else {
        const customizedImage = document.getElementById('customizedImage');
        const currentKitName = document.getElementById('currentKitName');
        
        if (customizedImage) customizedImage.src = kitImage;
        if (currentKitName) currentKitName.textContent = kitName;
    }
    
    // Actualizar detalles
    updateCustomizationDetails();
    
    // Actualizar precio
    updateTotalPrice();
}

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
                ${selectedKit.price > 0 ? `+${CONFIG.formatPrice(selectedKit.price)}` : 'Incluido'}
            </div>
        </div>
        
        ${selectedKit.features && selectedKit.features.length > 0 ? `
        <div style="font-size: 13px; color: #86868b; margin-bottom: 8px;">Incluye:</div>
        <div class="customization-features">
            ${selectedKit.features.map(feature => 
                `<div class="customization-feature">
                    <i class="fas fa-check"></i>
                    <span>${feature}</span>
                </div>`
            ).join('')}
        </div>
        ` : ''}
    `;
}

function updateTotalPrice() {
    if (!selectedVehicle || !selectedKit) return;
    
    const totalElement = document.getElementById('totalPrice');
    if (!totalElement) return;
    
    const total = selectedVehicle.price + selectedKit.price;
    const isMobile = window.innerWidth <= 768;
    
    totalElement.textContent = `${CONFIG.formatPrice(total)} CLP`;
    totalElement.style.fontSize = isMobile ? '28px' : '32px';
}

function showCustomizationModal() {
    const vehicles = DataLoader.getVehicles();
    if (vehicles.length === 0) {
        alert('No hay vehículos disponibles para personalizar.');
        return;
    }
    
    const modalContent = document.getElementById('customizationContent');
    if (!modalContent) return;
    
    modalContent.innerHTML = `
        <div class="customization-options">
            <h2 style="font-size: 28px; font-weight: 700; margin-bottom: 8px;">Simular Personalización</h2>
            <p style="color: #86868b; margin-bottom: 32px;">Selecciona un vehículo para comenzar</p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                ${vehicles.slice(0, 3).map(vehicle => 
                    `<div onclick="customizeVehicle(${vehicle.id})" style="cursor: pointer; border: var(--border); border-radius: var(--radius); padding: 20px; text-align: center;">
                        <img src="${vehicle.baseImage}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; margin-bottom: 12px;">
                        <div style="font-weight: 500; margin-bottom: 4px;">${vehicle.name}</div>
                        <div style="font-size: 14px; color: #86868b; margin-bottom: 8px;">${vehicle.description?.split('•')[0] || 'Vehículo americano'}</div>
                        <div style="font-size: 17px; font-weight: 600;">${CONFIG.formatPrice(vehicle.price)} CLP</div>
                    </div>`
                ).join('')}
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

function requestCustomization() {
    if (!selectedVehicle || !selectedKit) {
        alert('Por favor, selecciona un vehículo y un kit de personalización.');
        return;
    }
    
    const total = selectedVehicle.price + selectedKit.price;
    
    const message = `Hola, quisiera cotizar esta configuración personalizada:%0A%0A🚗 *Vehículo:* ${selectedVehicle.name}%0A💰 *Precio base:* ${CONFIG.formatPrice(selectedVehicle.price).replace('$', '')} CLP%0A%0A⚙️ *Kit seleccionado:* ${selectedKit.name}%0A📋 *Descripción:* ${selectedKit.description}%0A🔧 *Incluye:* ${selectedKit.features.slice(0, 3).join(', ')}%0A💵 *Valor kit:* ${CONFIG.formatPrice(selectedKit.price).replace('$', '')} CLP%0A%0A💵 *TOTAL CONFIGURACIÓN:* ${CONFIG.formatPrice(total).replace('$', '')} CLP%0A%0A¿Podemos proceder con esta configuración?`;
    
    trackEvent('request', 'Customization Quote', `${selectedVehicle.name} - ${selectedKit.name}`);
    window.open(`https://wa.me/${CONFIG.STATE.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
}

function contactVehicle(vehicleId) {
    let vehicle;
    let message;
    
    if (vehicleId === 0 || !vehicleId) {
        message = `Hola, estoy interesado en importar un vehículo desde USA. ¿Podrían contactarme para asesorarme?`;
    } else {
        vehicle = DataLoader.getVehicleById(vehicleId);
        if (!vehicle) {
            message = `Hola, tengo interés en sus vehículos americanos. ¿Podrían contactarme?`;
        } else {
            message = `Hola, estoy interesado en el vehículo: ${vehicle.name} (${CONFIG.formatPrice(vehicle.price).replace('$', '')} CLP). Estado: ${vehicle.status === 'stock' ? 'En Stock Arica' : 'En Tránsito'}. ¿Podrían darme más información?`;
        }
    }
    
    trackEvent('contact', 'WhatsApp', vehicle ? vehicle.name : 'General');
    window.open(`https://wa.me/${CONFIG.STATE.whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
}

function closeVehicleDetailsModal() {
    const modal = document.getElementById('vehicleDetailsModal');
    if (modal) {
        modal.style.display = 'none';
    }
    selectedVehicle = null;
    currentGalleryIndex = 0;
}

function closeCustomizationModal() {
    const modal = document.getElementById('customizationModal');
    if (modal) {
        modal.style.display = 'none';
    }
    selectedVehicle = null;
    selectedKit = null;
}

// Hacer disponibles globalmente
window.showVehicleDetails = showVehicleDetails;
window.changeGalleryImage = changeGalleryImage;
window.customizeVehicle = customizeVehicle;
window.selectKit = selectKit;
window.showCustomizationModal = showCustomizationModal;
window.requestCustomization = requestCustomization;
window.contactVehicle = contactVehicle;
window.closeVehicleDetailsModal = closeVehicleDetailsModal;
window.closeCustomizationModal = closeCustomizationModal;
