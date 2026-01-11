/* ========================================
   admin.js - Panel de Administración
   Import American Cars
   ======================================== */

let currentUser = null;
let uploadedImages = [];
let currentEditingVehicle = null;

// ====================================
// INICIALIZACIÓN
// ====================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔧 Inicializando panel admin...');
    
    try {
        vehicleAPI.init();
        await checkAuth();
        setupEventListeners();
        console.log('✅ Admin inicializado correctamente');
    } catch (error) {
        console.error('❌ Error al inicializar admin:', error);
        showNotification('Error al inicializar el panel', 'error');
    }
});

// ====================================
// AUTENTICACIÓN
// ====================================

async function checkAuth() {
    try {
        const user = await vehicleAPI.getCurrentUser();
        
        if (user) {
            currentUser = user;
            showAdminPanel();
            await loadAdminData();
        } else {
            showLoginScreen();
        }
    } catch (error) {
        console.error('Error al verificar autenticación:', error);
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
}

function showAdminPanel() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    
    const userEmail = document.getElementById('userEmail');
    if (userEmail && currentUser) {
        userEmail.textContent = currentUser.email;
    }
}

// Login Form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando sesión...';
            
            await vehicleAPI.signIn(email, password);
            showNotification('✅ Sesión iniciada correctamente', 'success');
            await checkAuth();
            
        } catch (error) {
            console.error('Error al iniciar sesión:', error);
            showNotification('❌ Email o contraseña incorrectos', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}

// Logout
async function logout() {
    if (!confirm('¿Cerrar sesión?')) return;
    
    try {
        await vehicleAPI.signOut();
        currentUser = null;
        showNotification('Sesión cerrada correctamente', 'success');
        showLoginScreen();
    } catch (error) {
        console.error('Error al cerrar sesión:', error);
        showNotification('Error al cerrar sesión', 'error');
    }
}

// ====================================
// CARGAR DATOS
// ====================================

async function loadAdminData() {
    console.log('📊 Cargando datos del panel...');
    await Promise.all([
        loadStats(),
        loadVehiclesTable()
    ]);
}

async function loadStats() {
    try {
        const stats = await vehicleAPI.getStats();
        
        document.getElementById('adminStockCount').textContent = stats.stock;
        document.getElementById('adminTransitCount').textContent = stats.transit;
        document.getElementById('adminReserveCount').textContent = stats.reserve;
        document.getElementById('adminTotalCount').textContent = stats.total;
        
        console.log('✅ Estadísticas cargadas:', stats);
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

async function loadVehiclesTable() {
    const container = document.getElementById('vehiclesTableContainer');
    if (!container) return;
    
    try {
        // Mostrar loading
        container.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
                <p>Cargando vehículos...</p>
            </div>
        `;
        
        const vehicles = await vehicleAPI.getAllVehicles();
        console.log(`🚗 ${vehicles.length} vehículos cargados`);
        
        if (vehicles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-car"></i>
                    <h3>No hay vehículos registrados</h3>
                    <p>Agrega tu primer vehículo usando el botón "Agregar Vehículo"</p>
                </div>
            `;
            return;
        }
        
        // Renderizar tabla
        container.innerHTML = `
            <div style="overflow-x: auto;">
                <table class="vehicles-table">
                    <thead>
                        <tr>
                            <th>Imagen</th>
                            <th>Nombre</th>
                            <th>Precio</th>
                            <th>Estado</th>
                            <th>Ubicación</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${vehicles.map(vehicle => `
                            <tr>
                                <td>
                                    <img 
                                        src="${vehicle.baseImage}" 
                                        alt="${vehicle.name}" 
                                        class="table-image"
                                    >
                                </td>
                                <td style="font-weight: 500;">
                                    ${vehicle.name}
                                </td>
                                <td style="font-weight: 600; color: var(--import-red);">
                                    $${formatPrice(vehicle.price)}
                                </td>
                                <td>
                                    <span class="badge ${APP_CONFIG.vehicleStatuses[vehicle.status].badge}">
                                        ${APP_CONFIG.vehicleStatuses[vehicle.status].label}
                                    </span>
                                </td>
                                <td>${vehicle.location || '-'}</td>
                                <td>
                                    <div class="action-buttons">
                                        <button 
                                            class="button button-small button-outline btn-icon" 
                                            onclick="editVehicle('${vehicle.id}')" 
                                            title="Editar"
                                        >
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button 
                                            class="button button-small button-outline btn-icon" 
                                            onclick="deleteVehicle('${vehicle.id}')" 
                                            title="Eliminar"
                                            style="color: var(--red); border-color: var(--red);"
                                        >
                                            <i class="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
    } catch (error) {
        console.error('Error al cargar tabla:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle" style="color: var(--red);"></i>
                <h3>Error al cargar vehículos</h3>
                <p>Por favor, recarga la página</p>
            </div>
        `;
    }
}

// ====================================
// TABS
// ====================================

function switchToTab(tabName) {
    console.log('🔄 Cambiando a tab:', tabName);
    
    // Actualizar botones de tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    const clickedTab = event?.target?.closest('.admin-tab');
    if (clickedTab) {
        clickedTab.classList.add('active');
    }
    
    // Actualizar contenido
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    const targetTab = document.getElementById(`${tabName}Tab`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
}

// ====================================
// EVENT LISTENERS
// ====================================

function setupEventListeners() {
    const imageUploadArea = document.getElementById('imageUploadArea');
    const imageInput = document.getElementById('imageInput');
    
    if (imageUploadArea && imageInput) {
        // Click en área de upload
        imageUploadArea.addEventListener('click', () => {
            imageInput.click();
        });
        
        // Drag & Drop
        imageUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            imageUploadArea.classList.add('drag-over');
        });
        
        imageUploadArea.addEventListener('dragleave', () => {
            imageUploadArea.classList.remove('drag-over');
        });
        
        imageUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            imageUploadArea.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files);
            handleImageFiles(files);
        });
        
        // Cambio en input
        imageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            handleImageFiles(files);
        });
    }
    
    // Formulario de vehículo
    const vehicleForm = document.getElementById('vehicleForm');
    if (vehicleForm) {
        vehicleForm.addEventListener('submit', handleVehicleSubmit);
    }
}

// ====================================
// MANEJO DE IMÁGENES
// ====================================

async function handleImageFiles(files) {
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
        showNotification('Por favor selecciona archivos de imagen válidos', 'error');
        return;
    }
    
    if (uploadedImages.length + validFiles.length > APP_CONFIG.maxImagesPerVehicle) {
        showNotification(`Máximo ${APP_CONFIG.maxImagesPerVehicle} imágenes permitidas`, 'error');
        return;
    }
    
    for (const file of validFiles) {
        // Validar tamaño
        if (file.size > APP_CONFIG.maxImageSize) {
            showNotification(`${file.name} es demasiado grande (máx 10MB)`, 'error');
            continue;
        }
        
        try {
            // Crear preview
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedImages.push({
                    file: file,
                    preview: e.target.result,
                    uploaded: false
                });
                renderImagePreview();
            };
            reader.readAsDataURL(file);
            
        } catch (error) {
            console.error('Error al procesar imagen:', error);
            showNotification(`Error al procesar ${file.name}`, 'error');
        }
    }
}

function renderImagePreview() {
    const container = document.getElementById('imagePreview');
    if (!container) return;
    
    container.innerHTML = uploadedImages.map((img, index) => `
        <div class="image-preview-item">
            <img src="${img.preview}" alt="Preview ${index + 1}">
            <button 
                type="button" 
                class="image-preview-remove" 
                onclick="removeImage(${index})"
            >
                <i class="fas fa-times"></i>
            </button>
            ${index === 0 ? '<div class="main-badge">Principal</div>' : ''}
        </div>
    `).join('');
}

function removeImage(index) {
    uploadedImages.splice(index, 1);
    renderImagePreview();
    showNotification('Imagen eliminada', 'info');
}

// ====================================
// SUBMIT FORMULARIO
// ====================================

async function handleVehicleSubmit(e) {
    e.preventDefault();
    
    const submitButton = document.getElementById('submitBtn');
    const originalText = submitButton.innerHTML;
    
    try {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        
        // Recopilar datos del formulario
        const formData = new FormData(e.target);
        const vehicleData = {
            name: formData.get('name'),
            price: parseInt(formData.get('price')),
            status: formData.get('status'),
            location: formData.get('location') || null,
            type: formData.get('type') || null,
            description: formData.get('description') || null,
            eta: formData.get('eta') || null,
            transit_time: formData.get('transit_time') ? parseInt(formData.get('transit_time')) : null,
            video_id: formData.get('video_id') || null,
            // Especificaciones
            motor: formData.get('motor') || null,
            potencia: formData.get('potencia') || null,
            torque: formData.get('torque') || null,
            transmision: formData.get('transmision') || null,
            traccion: formData.get('traccion') || null,
            combustible: formData.get('combustible') || null,
            consumo: formData.get('consumo') || null,
            capacidad: formData.get('capacidad') || null,
            color: formData.get('color') || null,
            kilometraje: formData.get('kilometraje') || null
        };
        
        console.log('💾 Guardando vehículo:', vehicleData);
        
        // Crear o actualizar vehículo
        const vehicle = currentEditingVehicle 
            ? await vehicleAPI.updateVehicle(currentEditingVehicle.id, vehicleData)
            : await vehicleAPI.createVehicle(vehicleData);
        
        console.log('✅ Vehículo guardado:', vehicle);
        
        // Subir imágenes si hay
        if (uploadedImages.length > 0) {
            showNotification(`Subiendo ${uploadedImages.length} imágenes...`, 'info');
            
            for (let i = 0; i < uploadedImages.length; i++) {
                const img = uploadedImages[i];
                
                try {
                    submitButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Subiendo imagen ${i + 1}/${uploadedImages.length}...`;
                    
                    const imageUrl = await uploadImageToCloudinary(img.file);
                    await vehicleAPI.addImage(vehicle.id, imageUrl, i === 0, i);
                    img.uploaded = true;
                    
                    console.log(`✅ Imagen ${i + 1} subida correctamente`);
                } catch (error) {
                    console.error(`Error al subir imagen ${i + 1}:`, error);
                    showNotification(`Error al subir imagen ${i + 1}`, 'error');
                }
            }
        }
        
        showNotification('✅ Vehículo guardado exitosamente', 'success');
        
        // Limpiar y recargar
        resetForm();
        await loadAdminData();
        switchToTab('vehicles');
        
    } catch (error) {
        console.error('Error al guardar vehículo:', error);
        showNotification('❌ Error al guardar vehículo: ' + error.message, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

// ====================================
// EDITAR VEHÍCULO
// ====================================

async function editVehicle(vehicleId) {
    try {
        console.log('✏️ Editando vehículo:', vehicleId);
        
        const vehicle = await vehicleAPI.getVehicle(vehicleId);
        currentEditingVehicle = vehicle;
        
        // Cambiar a tab de formulario
        switchToTab('add');
        
        // Esperar a que el DOM se actualice
        setTimeout(() => {
            // Llenar formulario
            const form = document.getElementById('vehicleForm');
            if (!form) {
                console.error('Formulario no encontrado');
                return;
            }
            
            // Llenar cada campo
            Object.keys(vehicle).forEach(key => {
                const field = form.elements[key];
                if (field) {
                    field.value = vehicle[key] || '';
                }
            });
            
            // Actualizar título y botón
            document.getElementById('formTitle').textContent = 'Editar Vehículo';
            document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Actualizar Vehículo';
            
            // Scroll al formulario
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            showNotification('Vehículo cargado para edición', 'info');
        }, 100);
        
    } catch (error) {
        console.error('Error al cargar vehículo para edición:', error);
        showNotification('Error al cargar vehículo', 'error');
    }
}

// ====================================
// ELIMINAR VEHÍCULO
// ====================================

async function deleteVehicle(vehicleId) {
    if (!confirm('⚠️ ¿Estás seguro de eliminar este vehículo?\n\nEsta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        console.log('🗑️ Eliminando vehículo:', vehicleId);
        
        await vehicleAPI.deleteVehicle(vehicleId);
        showNotification('✅ Vehículo eliminado correctamente', 'success');
        
        await loadAdminData();
        
    } catch (error) {
        console.error('Error al eliminar vehículo:', error);
        showNotification('❌ Error al eliminar vehículo', 'error');
    }
}

// ====================================
// CANCELAR / RESET FORMULARIO
// ====================================

function cancelForm() {
    if (currentEditingVehicle || uploadedImages.length > 0) {
        if (!confirm('¿Descartar cambios?')) {
            return;
        }
    }
    
    resetForm();
    switchToTab('vehicles');
}

function resetForm() {
    const form = document.getElementById('vehicleForm');
    if (form) form.reset();
    
    uploadedImages = [];
    renderImagePreview();
    currentEditingVehicle = null;
    
    document.getElementById('formTitle').textContent = 'Agregar Vehículo';
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Guardar Vehículo';
}

// ====================================
// EXPORTAR FUNCIONES GLOBALES
// ====================================

window.logout = logout;
window.switchToTab = switchToTab;
window.editVehicle = editVehicle;
window.deleteVehicle = deleteVehicle;
window.removeImage = removeImage;
window.cancelForm = cancelForm;

console.log('✅ Admin.js cargado correctamente');
