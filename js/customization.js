/* ========================================
   customization.js - Sistema de Personalización
   ======================================== */

let customizationVehicle = null;
let selectedKit = null;

// ABRIR PERSONALIZACIÓN
async function openCustomization(vehicleId) {
    try {
        const vehicle = await vehicleAPI.getVehicle(vehicleId);
        
        if (!vehicle) {
            showError('Vehículo no encontrado');
            return;
        }
        
        customizationVehicle = vehicle;
        selectedKit = vehicle.kits && vehicle.kits.length > 0 ? vehicle.kits[0] : null;
        
        trackEvent('open', 'Customization', vehicle.name);
        
        renderCustomization();
        
        const modal = document.getElementById('customizationModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        
    } catch (error) {
        console.error('Error:', error);
        showError('Error al cargar personalización');
    }
}

// RENDERIZAR
function renderCustomization() {
    const content = document.getElementById('customizationContent');
    if (!content || !customizationVehicle) return;
    
    const isMobile = window.innerWidth <= 768;
    
    content.innerHTML = `
        <div style="display: grid; grid-template-columns: ${isMobile ? '1fr' : '2fr 1fr'}; gap: 0;">
            <div style="padding: 32px;">
                <h2 style="font-size: 28px; font-weight: 700; margin-bottom: 8px;">
                    Personalizar ${customizationVehicle.name}
                </h2>
                <p style="color: var(--gray-300); margin-bottom: 32px;">
                    ${customizationVehicle.description || ''}
                </p>
                
                ${renderComparison()}
                
                ${customizationVehicle.kits && customizationVehicle.kits.length > 0 ? `
                    <h3 style="font-size: 17px; font-weight: 600; margin-bottom: 20px; margin-top: ${isMobile ? '20px' : '32px'};">
                        Selecciona un Kit
                    </h3>
                    
                    <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 32px;">
                        ${customizationVehicle.kits.map(kit => renderKitTab(kit)).join('')}
                    </div>
                    
                    ${selectedKit ? renderKitDetails() : ''}
                ` : `
                    <div style="background: var(--gray-50); padding: 24px; border-radius: var(--radius); text-align: center; color: var(--gray-300);">
                        <i class="fas fa-info-circle" style="font-size: 32px; margin-bottom: 12px; opacity: 0.5;"></i>
                        <p>Este vehículo aún no tiene kits configurados.</p>
                        <p style="margin-top: 8px;">Contáctanos para asesoría.</p>
                    </div>
                `}
                
                <div style="display: flex; gap: 12px; margin-top: 32px; flex-direction: ${isMobile ? 'column' : 'row'};">
                    <button class="button" onclick="requestCustomizationQuote()" style="flex: 1;">
                        <i class="fab fa-whatsapp"></i> Solicitar Cotización
                    </button>
                    <button class="button button-outline" onclick="closeCustomization(); showVehicleDetails('${customizationVehicle.id}')" style="flex: 1;">
                        <i class="fas fa-info-circle"></i> Ver Detalles
                    </button>
                </div>
            </div>
            
            ${renderSummary()}
        </div>
    `;
}

function renderComparison() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 32px;">
                <div style="position: relative; border-radius: var(--radius); overflow: hidden; border: var(--border); height: 180px;">
                    <div style="position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.8); color: white; padding: 4px 10px; border-radius: 16px; font-size: 11px; z-index: 2;">
                        Original
                    </div>
                    <img src="${customizationVehicle.baseImage}" alt="Original" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                
                <div style="position: relative; border-radius: var(--radius); overflow: hidden; border: var(--border); height: 180px;">
                    <div style="position: absolute; top: 8px; left: 8px; background: rgba(0,0,0,0.8); color: white; padding: 4px 10px; border-radius: 16px; font-size: 11px; z-index: 2;" id="mobileKitLabel">
                        ${selectedKit ? selectedKit.name : 'Básico'}
                    </div>
                    <img src="${selectedKit ? selectedKit.image_url : customizationVehicle.baseImage}" alt="Personalizado" style="width: 100%; height: 100%; object-fit: cover;" id="mobileCustomImage">
                </div>
            </div>
        `;
    }
    
    return `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px;">
            <div style="position: relative; border-radius: var(--radius); overflow: hidden; border: var(--border); height: 300px;">
                <div style="position: absolute; top: 16px; left: 16px; background: var(--black); color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; z-index: 2;">
                    Vehículo Base
                </div>
                <img src="${customizationVehicle.baseImage}" alt="Base" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
            
            <div style="position: relative; border-radius: var(--radius); overflow: hidden; border: var(--border); height: 300px;">
                <div style="position: absolute; top: 16px; left: 16px; background: var(--black); color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; z-index: 2;">
                    Con Kit: <span id="currentKitName">${selectedKit ? selectedKit.name : 'Básico'}</span>
                </div>
                <img src="${selectedKit ? selectedKit.image_url : customizationVehicle.baseImage}" alt="Personalizado" style="width: 100%; height: 100%; object-fit: cover;" id="customizedImage">
            </div>
        </div>
    `;
}

function renderKitTab(kit) {
    const isSelected = selectedKit && selectedKit.id === kit.id;
    const levelConfig = APP_CONFIG.kitLevels[kit.level] || { label: kit.level, color: '#000' };
    
    return `
        <div class="kit-tab ${isSelected ? 'selected' : ''}" 
             onclick="selectKit('${kit.id}')"
             style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background: ${isSelected ? 'var(--import-red-light)' : 'var(--white)'}; border: ${isSelected ? '1px solid var(--import-red)' : 'var(--border)'}; border-radius: var(--radius); cursor: pointer; transition: var(--transition);">
            
            <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                <div style="padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 500; text-transform: uppercase; min-width: 70px; text-align: center; background: ${levelConfig.color}20; color: ${levelConfig.color};">
                    ${levelConfig.label}
                </div>
                <div style="font-size: 14px; font-weight: 500; flex: 1;">
                    ${kit.description || kit.name}
                </div>
            </div>
            
            <div style="font-size: 15px; font-weight: 600; color: ${kit.price > 0 ? 'var(--import-red)' : 'var(--gray-300)'}; min-width: 100px; text-align: right;">
                ${kit.price > 0 ? `+$${formatPrice(kit.price)}` : 'Incluido'}
            </div>
        </div>
    `;
}

function renderKitDetails() {
    if (!selectedKit) return '';
    
    return `
        <div style="background: var(--gray-50); border-radius: var(--radius); padding: 24px; margin-top: 24px; border: var(--border);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
                <div>
                    <h4 style="font-size: 15px; font-weight: 600; margin-bottom: 4px;">Kit ${selectedKit.name}</h4>
                    <p style="font-size: 13px; color: var(--gray-300);">${selectedKit.description || ''}</p>
                </div>
                <div style="font-size: 18px; font-weight: 700; color: ${selectedKit.price > 0 ? 'var(--import-red)' : 'var(--gray-300)'};">
                    ${selectedKit.price > 0 ? `+$${formatPrice(selectedKit.price)}` : 'Incluido'}
                </div>
            </div>
            
            ${selectedKit.features && selectedKit.features.length > 0 ? `
                <div style="font-size: 13px; color: var(--gray-300); margin-bottom: 8px;">Incluye:</div>
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
                    ${selectedKit.features.map(feature => `
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                            <i class="fas fa-check" style="color: var(--import-red); font-size: 12px;"></i>
                            <span>${feature}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

function renderSummary() {
    const isMobile = window.innerWidth <= 768;
    const totalPrice = customizationVehicle.price + (selectedKit ? selectedKit.price : 0);
    
    return `
        <div style="padding: 32px; background: var(--gray-50); ${isMobile ? 'border-top: var(--border);' : 'border-left: var(--border);'}">
            <h3 style="font-size: 17px; font-weight: 600; margin-bottom: 24px;">Tu Configuración</h3>
            
            <div style="margin-bottom: 24px;">
                <div style="font-size: 13px; color: var(--gray-300); margin-bottom: 8px;">Vehículo base</div>
                <div style="font-weight: 500;">${customizationVehicle.name}</div>
                <div style="font-size: ${isMobile ? '24px' : '21px'}; font-weight: 700; margin-top: 4px;">
                    $${formatPrice(customizationVehicle.price)} CLP
                </div>
            </div>
            
            ${selectedKit ? `
                <div style="margin-bottom: 24px;">
                    <div style="font-size: 13px; color: var(--gray-300); margin-bottom: 8px;">Personalización</div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                        <div>
                            <div style="font-weight: 500;">Kit ${selectedKit.name}</div>
                            <div style="font-size: 12px; color: var(--gray-300);">${selectedKit.description || ''}</div>
                        </div>
                        <div style="font-size: ${isMobile ? '18px' : '17px'}; font-weight: 600; color: ${selectedKit.price > 0 ? 'var(--import-red)' : 'var(--gray-300)'}">
                            ${selectedKit.price > 0 ? `+$${formatPrice(selectedKit.price)}` : 'Incluido'}
                        </div>
                    </div>
                </div>
            ` : ''}
            
            <div style="border-top: var(--border); padding-top: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 600; font-size: 17px;">Total</div>
                    <div style="font-size: ${isMobile ? '28px' : '32px'}; font-weight: 700;">
                        $${formatPrice(totalPrice)} CLP
                    </div>
                </div>
                <div style="font-size: 12px; color: var(--gray-300); margin-top: 8px;">
                    Incluye instalación profesional y garantía
                </div>
            </div>
        </div>
    `;
}

async function selectKit(kitId) {
    if (!customizationVehicle || !customizationVehicle.kits) return;
    
    const kit = customizationVehicle.kits.find(k => k.id === kitId);
    if (!kit) return;
    
    selectedKit = kit;
    trackEvent('select', 'Kit', kit.name);
    
    renderCustomization();
}

function requestCustomizationQuote() {
    if (!customizationVehicle) return;
    
    const total = customizationVehicle.price + (selectedKit ? selectedKit.price : 0);
    
    let message = `Hola, quisiera cotizar:%0A%0A`;
    message += `🚗 ${customizationVehicle.name}%0A`;
    message += `💰 Base: $${formatPrice(customizationVehicle.price)} CLP%0A%0A`;
    
    if (selectedKit) {
        message += `⚙️ Kit: ${selectedKit.name}%0A`;
        message += `💵 +$${formatPrice(selectedKit.price)} CLP%0A%0A`;
    }
    
    message += `💵 TOTAL: $${formatPrice(total)} CLP`;
    
    trackEvent('request', 'Quote', `${customizationVehicle.name} - ${selectedKit ? selectedKit.name : 'Sin kit'}`);
    window.open(`https://wa.me/${CONTACT_CONFIG.whatsapp}?text=${message}`, '_blank');
}

function closeCustomization() {
    const modal = document.getElementById('customizationModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
    
    customizationVehicle = null;
    selectedKit = null;
}

console.log('✅ Customization.js cargado');
