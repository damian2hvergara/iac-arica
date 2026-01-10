/* ========================================
   admin.js - Panel de Administración
   ======================================== */

let currentUser = null;
let uploadedImages = [];
let currentEditingVehicle = null;

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', async () => {
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
        console.error('Error:', error);
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
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        await vehicleAPI.signIn(email, password);
        showNotification('Sesión iniciada', 'success');
        await checkAuth();
    } catch (error) {
        console.error('Error:', error);
        showError('Email o contraseña incorrectos');
    }
});

// LOGOUT
async function logout() {
    try {
        await vehicleAPI.signOut();
        currentUser = null;
        showNotification('Sesión cerrada', 'success');
        showLoginScreen();
    } catch (error) {
        console.error('Error:', error);
        showError('Error al cerrar sesión');
    }
}

// CARGAR DATOS
async function loadAdminData() {
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
        
    } catch (error) {
        console.error('Error:', error);
    }
}

async function loadVehiclesTable() {
    const container = document.getElementById('vehiclesTableContainer');
    if (!container) return;
    
    try {
        const vehicles = await vehicleAPI.getAllVehicles();
        
        if (vehicles.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-car"></i>
                    <h3>No hay vehículos</h3>
                    <p>Agrega tu primer vehículo</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
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
                            <td>${vehicle.name}</td>
                            <td>$${formatPrice(vehicle.price)}</td>
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
        `;
        
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error al cargar</h3>
                <p>Recarga la página</p>
            </div>
        `;
    }
}

// TABS
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    event.target.closest('.tab').classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

// EVENT LISTENERS
function setupAdminEventListeners() {
    const imageUploadArea = document.getElementById('imageUploadArea');
    const imageInput = document.getElementById('imageInput');
    
    if (imageUploadArea && imageInput) {
        imageUploadArea.addEventListener('click', () => imageInput.click());
        
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
        
        imageInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            handleImageFiles(files);
        });
    }
    
    const vehicleForm = document.getElementById('vehicleForm');
    if (vehicleForm) {
        vehicleForm.addEventListener('submit', handleVehicleSubmit);
    }
}

async function handleImageFiles(files) {
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
        showError('Selecciona archivos de imagen válidos');
        return;
    }
    
    if (uploadedImages.length + validFiles.length > APP_CONFIG.maxImagesPerVehicle) {
        showError(`Máximo ${APP_CONFIG.maxImagesPerVehicle} imágenes`);
        return;
    }
    
    for (const file of validFiles) {
        if (file.size > APP_CONFIG.maxImageSize) {
            showError(`${file.name} es demasiado grande (máx 10MB)`);
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
            showError(`Error al procesar ${file.name}`);
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
            ${index === 0 ? '<div style="position: absolute; bottom: 4px; left: 4px; background: var(--import-red); color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px;">Principal</div>' : ''}
        </div>
    `).join('');
}

function removeImage(index) {
    uploadedImages.splice(index, 1);
    renderImagePreview();
}

async function handleVehicleSubmit(e) {
    e.preventDefault();
    
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;
    
    try {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        
        const formData = new FormData(e.target);
        const vehicleData = {
            name: formData.get('name'),
            price: parseInt(formData.get('price')),
            status: formData.get('status'),
            location: formData.get('location'),
            type: formData.get('type'),
            description: formData.get('description'),
            eta: formData.get('eta'),
            transit_time: formData.get('transit_time') ? parseInt(formData.get('transit_time')) : null,
            video_id: formData.get('video_id'),
            motor: formData.get('motor'),
            potencia: formData.get('potencia'),
            torque: formData.get('torque'),
            transmision: formData.get('transmision'),
            traccion: formData.get('traccion'),
            combustible: formData.get('combustible'),
            consumo: formData.get('consumo'),
            capacidad: formData.get('capacidad'),
            color: formData.get('color'),
            kilometraje: formData.get('kilometraje')
        };
        
        const vehicle = await vehicleAPI.createVehicle(vehicleData);
        
        if (uploadedImages.length > 0) {
            showNotification('Subiendo imágenes...', 'info');
            
            for (let i = 0; i < uploadedImages.length; i++) {
                const img = uploadedImages[i];
                
                try {
                    const imageUrl = await uploadImageToCloudinary(img.file);
                    await vehicleAPI.addImage(vehicle.id, imageUrl, i === 0, i);
                    img.uploaded = true;
                } catch (error) {
                    console.error('Error:', error);
                    showError(`Error al subir imagen ${i + 1}`);
                }
            }
        }
        
        showNotification('Vehículo creado exitosamente', 'success');
        
        resetForm();
        await loadAdminData();
        switchTab('vehicles');
        
    } catch (error) {
        console.error('Error:', error);
        showError('Error al crear vehículo');
    } finally {
        submitButton.disabled = false;
        submitButton.innerHTML = originalText;
    }
}

function resetForm() {
    document.getElementById('vehicleForm')?.reset();
    uploadedImages = [];
    renderImagePreview();
    currentEditingVehicle = null;
}

async function editVehicle(vehicleId) {
    try {
        const vehicle = await vehicleAPI.getVehicle(vehicleId);
        currentEditingVehicle = vehicle;
        
        switchTab('add');
        
        const form = document.getElementById('vehicleForm');
        if (!form) return;
        
        Object.keys(vehicle).forEach(key => {
            if (form.elements[key]) {
                form.elements[key].value = vehicle[key] || '';
            }
        });
        
        document.querySelector('#addTab .card-title').textContent = 'Editar Vehículo';
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Actualizar';
        
        showNotification('Cargado para edición', 'info');
        
    } catch (error) {
        console.error('Error:', error);
        showError('Error al cargar vehículo');
    }
}

async function deleteVehicle(vehicleId) {
    if (!confirm('¿Eliminar este vehículo? No se puede deshacer.')) {
        return;
    }
    
    try {
        await vehicleAPI.deleteVehicle(vehicleId);
        showNotification('Vehículo eliminado', 'success');
        await loadAdminData();
    } catch (error) {
        console.error('Error:', error);
        showError('Error al eliminar');
    }
}

console.log('✅ Admin.js cargado');
