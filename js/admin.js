/* ========================================
   admin.js - Panel Admin FUNCIONAL
   ======================================== */

let currentUser = null;
let uploadedImages = [];
let currentEditingVehicle = null;

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🔧 Inicializando admin...');
    try {
        vehicleAPI.init();
        await checkAuth();
        setupAdminEventListeners();
    } catch (error) {
        console.error('Error:', error);
    }
});

// AUTENTICACIÓN
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
        console.error('Error auth:', error);
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminPanel').style.display = 'none';
}

function showAdminPanel() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminPanel').style.display = 'block';
    
    const userEmail = document.getElementById('userEmail');
    if (userEmail && currentUser) {
        userEmail.textContent = currentUser.email;
    }
}

// LOGIN
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
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando...';
            
            await vehicleAPI.signIn(email, password);
            showNotification('✅ Sesión iniciada correctamente', 'success');
            await checkAuth();
            
        } catch (error) {
            console.error('Error login:', error);
            showNotification('❌ Email o contraseña incorrectos', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });
}

// LOGOUT
async function logout() {
    if (!confirm('¿Cerrar sesión?')) return;
    
    try {
        await vehicleAPI.signOut();
        currentUser = null;
        showNotification('Sesión cerrada', 'success');
        showLoginScreen();
    } catch (error) {
        console.error('Error logout:', error);
        showNotification('Error al cerrar sesión', 'error');
    }
}

// CARGAR DATOS
async function loadAdminData() {
    console.log('📊 Cargando datos admin...');
    await Promise.all([
        loadAdminStats(),
        loadVehiclesTable()
    ]);
}

async function loadAdminStats() {
    try {
        const stats = await vehicleAPI.getStats();
        
        document.getElementById('adminStockCount').textContent = stats.stock;
        document.getElementById('adminTransitCount').textContent = stats.transit;
        document.getElementById('adminReserveCount').textContent = stats.reserve;
        document.getElementById('adminTotalCount').textContent = stats.total;
        
        console.log('✅ Stats cargados:', stats);
    } catch (error) {
        console.error('Error stats:', error);
    }
}

async function loadVehiclesTable() {
    const container = document.getElementById('vehiclesTableContainer');
    if (!container) return;
    
    try {
        const vehicles = await vehicleAPI.getAllVehicles();
        console.log('🚗 Vehículos cargados:', vehicles.length);
        
        if (vehicles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-car" style="font-size: 48px; color: var(--gray-200); margin-bottom: 16px;"></i>
                    <h3 style="color: var(--gray-800); margin-bottom: 8px;">No hay vehículos</h3>
                    <p style="color: var(--gray-300);">Agrega tu primer vehículo usando el botón "Agregar Vehículo"</p>
                </div>
            `;
            return;
        }
        
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
                                <td><img src="${vehicle.baseImage}" alt="${vehicle.name}" class="table-image"></td>
                                <td style="font-weight: 500;">${vehicle.name}</td>
                                <td style="font-weight: 600;">$${formatPrice(vehicle.price)}</td>
                                <td><span class="badge ${APP_CONFIG.vehicleStatuses[vehicle.status].badge}">${APP_CONFIG.vehicleStatuses[vehicle.status].label}</span></td>
                                <td>${vehicle.location || '-'}</td>
                                <td>
                                    <div class="action-buttons">
                                        <button class="button button-small button-outline btn-icon" onclick="editVehicle('${vehicle.id}')" title="Editar">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        <button class="button button-small button-outline btn-icon" onclick="deleteVehicle('${vehicle.id}')" title="Eliminar" style="color: var(--red); border-color: var(--red);">
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
        console.error('Error tabla:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle" style="font-size: 48px; color: var(--red); margin-bottom: 16px;"></i>
                <h3 style="color: var(--gray-800); margin-bottom: 8px;">Error al cargar</h3>
                <p style="color: var(--gray-300);">Recarga la página</p>
            </div>
        `;
    }
}

// TABS
function switchToTab(tabName) {
    console.log('🔄 Cambiando a tab:', tabName);
    
    // Actualizar tabs
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    const clickedTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
    if (clickedTab) {
        clickedTab.classList.add('active');
    }
    
    // Actualizar contenido
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    const targetTab = document.getElementById(`${tabName}Tab`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
}

// MANEJO DE IMÁGENES
function setupAdminEventListeners() {
    const imageUploadArea = document.getElementById('imageUploadArea');
    const imageInput = document.getElementById('imageInput');
    
    if (imageUploadArea && imageInput) {
        // Click
        imageUploadArea.addEventListener('click', () => imageInput.click());
        
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
        
        // Input
        imageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            handleImageFiles(files);
        });
    }
    
    // Formulario
    const vehicleForm = document.getElementById('vehicleForm');
    if (vehicleForm) {
        vehicleForm.addEventListener('submit', handleVehicleSubmit);
    }
}

async function handleImageFiles(files) {
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
        showNotification('Selecciona archivos de imagen válidos', 'error');
        return;
    }
    
    if (uploadedImages.length + validFiles.length > APP_CONFIG.maxImagesPerVehicle) {
        showNotification(`Máximo ${APP_CONFIG.maxImagesPerVehicle} imágenes`, 'error');
        return;
    }
    
    for (const file of validFiles) {
        if (file.size > APP_CONFIG.maxImageSize) {
            showNotification(`${file.name} es demasiado grande (máx 10MB)`, 'error');
            continue;
        }
        
        try {
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
            console.error('Error:', error);
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
            <button type="button" class="image-preview-remove" onclick="removeImage(${index})">
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

// SUBMIT FORMULARIO
async function handleVehicleSubmit(e) {
    e.preventDefault();
    
    const submitButton = document.getElementById('submitBtn');
    const originalText = submitButton.innerHTML;
    
    try {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        
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
        
        const vehicle = currentEditingVehicle 
            ? await vehicleAPI.updateVehicle(currentEditingVehicle.id, vehicleData)
            : await vehicleAPI.createVehicle(vehicleData);
        
        console.log('✅ Vehículo guardado:', vehicle);
        
        // Subir imágenes
        if (uploadedImages.length > 0) {
            showNotification(`Subiendo ${uploadedImages.length} imágenes...`, 'info');
            
            for (let i = 0; i < uploadedImages.length; i++) {
                const img = uploadedImages[i];
                
                try {
                    submitButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Subiendo imagen ${i + 1}/${uploadedImages.length}...`;
                    
                    const imageUrl = await uploadImageToCloudinary(img.file);
                    await vehicleAPI.addImage(vehicle.id, imageUrl, i === 0, i);
                    img.uploaded = true;
                    
                    console.log(`✅ Imagen ${i + 1} subida`);
                } catch (error) {
                    console.error(`Error imagen ${i + 1}:`, error);
                    showNotification(`Error al subir imagen ${i + 1}`, 'error');
                }
            }
        }
        
        showNotification('✅ Vehículo guardado exitosamente', 'success');
        
        resetForm();
        await loadAdminData();
        switchToTab('vehicles');
        
    } catch (error) {
        console.error('Error guardar:', error);
        showNotification('❌ Error al guardar vehículo', 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

// EDITAR VEHÍCULO
async function editVehicle(vehicleId) {
    try {
        console.log('✏️ Editando vehículo:', vehicleId);
        const vehicle = await vehicleAPI.getVehicle(vehicleId);
        currentEditingVehicle = vehicle;
        
        switchToTab('add');
        
        // Llenar formulario
        const form = document.getElementById('vehicleForm');
        if (!form) return;
        
        Object.keys(vehicle).forEach(key => {
            if (form.elements[key]) {
                form.elements[key].value = vehicle[key] || '';
            }
        });
        
        // Cambiar título
        document.getElementById('formTitle').textContent = 'Editar Vehículo';
        document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Actualizar Vehículo';
        
        showNotification('Vehículo cargado para edición', 'info');
        
    } catch (error) {
        console.error('Error editar:', error);
        showNotification('Error al cargar vehículo', 'error');
    }
}

// ELIMINAR VEHÍCULO
async function deleteVehicle(vehicleId) {
    if (!confirm('⚠️ ¿Eliminar este vehículo? Esta acción no se puede deshacer.')) {
        return;
    }
    
    try {
        console.log('🗑️ Eliminando:', vehicleId);
        await vehicleAPI.deleteVehicle(vehicleId);
        showNotification('✅ Vehículo eliminado', 'success');
        await loadAdminData();
    } catch (error) {
        console.error('Error eliminar:', error);
        showNotification('❌ Error al eliminar', 'error');
    }
}

// RESET FORMULARIO
function resetForm() {
    const form = document.getElementById('vehicleForm');
    if (form) form.reset();
    
    uploadedImages = [];
    renderImagePreview();
    currentEditingVehicle = null;
    
    document.getElementById('formTitle').textContent = 'Agregar Vehículo';
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Guardar Vehículo';
}

console.log('✅ Admin.js cargado y listo');
