/* ========================================
   admin.js - Panel de Administración
   Import American Cars
   ======================================== */

// ====================================
// ESTADO GLOBAL DEL ADMIN
// ====================================
let adminClient = null;
let allVehicles = [];
let editingVehicleId = null;
let uploadedImages = [];

// ====================================
// INICIALIZACIÓN
// ====================================

document.addEventListener('DOMContentLoaded', () => {
    adminClient = supabase.createClient(
        APP_CONFIG.supabase.url,
        APP_CONFIG.supabase.anonKey
    );

    checkAuth();
    setupLoginForm();
    setupVehicleForm();
    setupImageUpload();
});

/**
 * Verificar autenticación
 */
async function checkAuth() {
    const { data: { session } } = await adminClient.auth.getSession();

    if (session) {
        showAdminPanel(session.user.email);
        loadVehicles();
    } else {
        showLoginScreen();
    }

    // Escuchar cambios de auth
    adminClient.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            showAdminPanel(session.user.email);
            loadVehicles();
        } else if (event === 'SIGNED_OUT') {
            showLoginScreen();
        }
    });
}

/**
 * Mostrar pantalla de login
 */
function showLoginScreen() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('adminPanel').classList.add('hidden');
}

/**
 * Mostrar panel de administración
 */
function showAdminPanel(email) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('userEmail').textContent = email;
}

/**
 * Setup formulario de login
 */
function setupLoginForm() {
    const form = document.getElementById('loginForm');
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const btn = form.querySelector('button[type="submit"]');

        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando...';

        const { error } = await adminClient.auth.signInWithPassword({ email, password });

        if (error) {
            alert('Error: ' + error.message);
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';
        }
    });
}

/**
 * Cerrar sesión
 */
async function logout() {
    await adminClient.auth.signOut();
}

// ====================================
// CARGAR VEHÍCULOS
// ====================================

/**
 * Cargar todos los vehículos
 */
async function loadVehicles() {
    try {
        const { data, error } = await adminClient
            .from('vehicles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        allVehicles = data || [];
        renderVehiclesTable(allVehicles);
        updateStats(allVehicles);
    } catch (error) {
        console.error('Error loading vehicles:', error);
        document.getElementById('vehiclesTableContainer').innerHTML =
            '<p style="padding: 2rem; text-align: center; color: var(--import-red);">Error al cargar vehículos: ' + error.message + '</p>';
    }
}

/**
 * Actualizar estadísticas
 */
function updateStats(vehicles) {
    document.getElementById('adminStockCount').textContent =
        vehicles.filter(v => v.status === 'stock').length;
    document.getElementById('adminTransitCount').textContent =
        vehicles.filter(v => v.status === 'transit').length;
    document.getElementById('adminReserveCount').textContent =
        vehicles.filter(v => v.status === 'reserve').length;
    document.getElementById('adminTotalCount').textContent = vehicles.length;
}

/**
 * Renderizar tabla de vehículos
 */
function renderVehiclesTable(vehicles) {
    const container = document.getElementById('vehiclesTableContainer');
    if (!container) return;

    if (vehicles.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--gray-300);">
                <i class="fas fa-car" style="font-size: 3rem; margin-bottom: 1rem; display: block; opacity: 0.3;"></i>
                <p>No hay vehículos. <a href="#" onclick="switchToTab('add'); return false;">Agrega el primero</a>.</p>
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
                    <th>Tipo</th>
                    <th>Vistas</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${vehicles.map(v => renderVehicleRow(v)).join('')}
            </tbody>
        </table>
    `;
}

/**
 * Renderizar fila de vehículo
 */
function renderVehicleRow(vehicle) {
    const statusColors = {
        stock: 'var(--green)',
        transit: 'var(--blue)',
        reserve: 'var(--orange)'
    };
    const statusLabels = {
        stock: 'En Stock',
        transit: 'En Tránsito',
        reserve: 'Reservar'
    };

    const mainImage = vehicle.images?.[0] || '';
    const statusColor = statusColors[vehicle.status] || 'var(--gray-400)';
    const statusLabel = statusLabels[vehicle.status] || vehicle.status;

    return `
        <tr>
            <td>
                ${mainImage
                    ? `<img src="${mainImage}" alt="${vehicle.name}" class="table-image">`
                    : '<div style="width:60px;height:60px;background:var(--gray-100);border-radius:8px;"></div>'
                }
            </td>
            <td>
                <strong>${vehicle.name}</strong>
                <br>
                <small style="color:var(--gray-300);">${vehicle.year || ''}</small>
            </td>
            <td>
                <strong>${formatCurrency(vehicle.price)}</strong>
            </td>
            <td>
                <span style="color: ${statusColor}; font-weight: 600; font-size: 13px;">
                    ● ${statusLabel}
                </span>
            </td>
            <td style="color: var(--gray-400); font-size: 13px;">${vehicle.type || '-'}</td>
            <td style="color: var(--gray-400); font-size: 13px;">${vehicle.view_count || 0}</td>
            <td>
                <div class="action-buttons">
                    <button class="button button-outline btn-icon" onclick="editVehicle('${vehicle.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="button btn-icon" style="background:var(--import-red); color:white;" 
                            onclick="deleteVehicle('${vehicle.id}', '${vehicle.name.replace(/'/g, "\\'")}'')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

// ====================================
// FORMULARIO DE VEHÍCULO
// ====================================

/**
 * Setup formulario de vehículo
 */
function setupVehicleForm() {
    const form = document.getElementById('vehicleForm');
    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveVehicle(form);
    });
}

/**
 * Setup upload de imágenes
 */
function setupImageUpload() {
    const uploadArea = document.getElementById('imageUploadArea');
    const fileInput = document.getElementById('imageInput');

    uploadArea?.addEventListener('click', () => fileInput?.click());

    uploadArea?.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--import-red)';
    });

    uploadArea?.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = '';
    });

    uploadArea?.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '';
        const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
        handleImageFiles(files);
    });

    fileInput?.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        handleImageFiles(files);
    });
}

/**
 * Manejar archivos de imágenes
 */
async function handleImageFiles(files) {
    if (files.length === 0) return;

    const remaining = 10 - uploadedImages.length;
    const toProcess = files.slice(0, remaining);

    for (const file of toProcess) {
        await uploadImageToCloudinary(file);
    }
}

/**
 * Upload imagen a Cloudinary
 */
async function uploadImageToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', APP_CONFIG.cloudinary.uploadPreset);
    formData.append('folder', APP_CONFIG.cloudinary.folder);

    // Mostrar preview con loading
    const tempId = 'temp-' + Date.now();
    addImagePreview(tempId, null, true);

    try {
        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${APP_CONFIG.cloudinary.cloudName}/image/upload`,
            { method: 'POST', body: formData }
        );

        const data = await response.json();

        if (data.secure_url) {
            uploadedImages.push(data.secure_url);
            updateImagePreview(tempId, data.secure_url);
        } else {
            removeImagePreview(tempId);
            alert('Error al subir imagen: ' + (data.error?.message || 'Error desconocido'));
        }
    } catch (error) {
        removeImagePreview(tempId);
        console.error('Upload error:', error);
        alert('Error de conexión al subir imagen');
    }
}

/**
 * Agregar preview de imagen
 */
function addImagePreview(id, url, loading = false) {
    const container = document.getElementById('imagePreview');
    if (!container) return;

    const div = document.createElement('div');
    div.id = id;
    div.className = 'image-preview-item';
    div.style.cssText = `
        position: relative;
        width: 120px;
        height: 90px;
        border-radius: 8px;
        overflow: hidden;
        background: var(--gray-100);
        display: inline-block;
        margin: 4px;
        vertical-align: top;
    `;

    if (loading) {
        div.innerHTML = `
            <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                <i class="fas fa-spinner fa-spin" style="color:var(--import-red);"></i>
            </div>
        `;
    } else {
        div.innerHTML = `
            <img src="${url}" style="width:100%;height:100%;object-fit:cover;">
            ${uploadedImages.indexOf(url) === 0 ? '<span class="main-badge">Principal</span>' : ''}
            <button onclick="removeImage('${url}')" style="
                position:absolute;top:4px;right:4px;
                width:22px;height:22px;border-radius:50%;
                background:rgba(0,0,0,0.7);color:white;
                border:none;cursor:pointer;font-size:10px;
                display:flex;align-items:center;justify-content:center;
            "><i class="fas fa-times"></i></button>
        `;
    }

    container.appendChild(div);
}

/**
 * Actualizar preview de imagen
 */
function updateImagePreview(tempId, url) {
    const div = document.getElementById(tempId);
    if (!div) return;

    const isMain = uploadedImages.length === 1;
    div.innerHTML = `
        <img src="${url}" style="width:100%;height:100%;object-fit:cover;">
        ${isMain ? '<span class="main-badge">Principal</span>' : ''}
        <button onclick="removeImage('${url}')" style="
            position:absolute;top:4px;right:4px;
            width:22px;height:22px;border-radius:50%;
            background:rgba(0,0,0,0.7);color:white;
            border:none;cursor:pointer;font-size:10px;
            display:flex;align-items:center;justify-content:center;
        "><i class="fas fa-times"></i></button>
    `;
}

/**
 * Eliminar imagen
 */
function removeImage(url) {
    uploadedImages = uploadedImages.filter(img => img !== url);
    refreshImagePreviews();
}

/**
 * Refrescar previews completos
 */
function refreshImagePreviews() {
    const container = document.getElementById('imagePreview');
    if (!container) return;
    container.innerHTML = '';
    uploadedImages.forEach(url => addImagePreview('img-' + Date.now(), url, false));
}

/**
 * Eliminar preview de imagen
 */
function removeImagePreview(id) {
    document.getElementById(id)?.remove();
}

/**
 * Guardar vehículo (crear o actualizar)
 */
async function saveVehicle(form) {
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        // Construir specs desde los campos de especificaciones
        const specParts = [];
        if (data.motor) specParts.push(data.motor);
        if (data.traccion) specParts.push(data.traccion);
        if (data.transmision) specParts.push(data.transmision);
        const specs = specParts.join(' · ');

        // Construir objeto de vehículo
        const vehiclePayload = {
            name: data.name,
            year: parseInt(data.year) || new Date().getFullYear(),
            price: parseInt(data.price),
            status: data.status,
            type: detectVehicleType(data.name),
            description: data.description || '',
            specs: specs,
            images: uploadedImages,
            arrival_date: data.eta || null
        };

        let result;

        if (editingVehicleId) {
            // Actualizar
            const { data: updated, error } = await adminClient
                .from('vehicles')
                .update(vehiclePayload)
                .eq('id', editingVehicleId)
                .select()
                .single();
            if (error) throw error;
            result = updated;
            showToast('✅ Vehículo actualizado correctamente');
        } else {
            // Crear
            const { data: created, error } = await adminClient
                .from('vehicles')
                .insert(vehiclePayload)
                .select()
                .single();
            if (error) throw error;
            result = created;
            showToast('✅ Vehículo creado correctamente');
        }

        // Limpiar formulario y volver a lista
        resetForm();
        switchToTab('vehicles');
        await loadVehicles();

    } catch (error) {
        console.error('Error saving vehicle:', error);
        alert('Error al guardar: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Guardar Vehículo';
    }
}

/**
 * Editar vehículo
 */
async function editVehicle(vehicleId) {
    const vehicle = allVehicles.find(v => v.id === vehicleId);
    if (!vehicle) return;

    editingVehicleId = vehicleId;
    uploadedImages = vehicle.images || [];

    // Cambiar a tab de edición
    switchToTab('add');

    const form = document.getElementById('vehicleForm');
    const title = document.getElementById('formTitle');
    if (title) title.textContent = 'Editar Vehículo';

    // Rellenar campos
    const setField = (name, value) => {
        const field = form?.querySelector(`[name="${name}"]`);
        if (field) field.value = value || '';
    };

    setField('name', vehicle.name);
    setField('price', vehicle.price);
    setField('status', vehicle.status);
    setField('type', vehicle.type);
    setField('description', vehicle.description);
    setField('eta', vehicle.arrival_date);

    // Parsear specs
    if (vehicle.specs) {
        const parts = vehicle.specs.split(' · ');
        if (parts[0]) setField('motor', parts[0]);
        if (parts[1]) setField('traccion', parts[1]);
        if (parts[2]) setField('transmision', parts[2]);
    }

    // Mostrar imágenes existentes
    refreshImagePreviews();
}

/**
 * Eliminar vehículo
 */
async function deleteVehicle(vehicleId, vehicleName) {
    if (!confirm(`¿Estás seguro de eliminar "${vehicleName}"? Esta acción no se puede deshacer.`)) return;

    try {
        const { error } = await adminClient
            .from('vehicles')
            .delete()
            .eq('id', vehicleId);

        if (error) throw error;

        showToast('🗑️ Vehículo eliminado');
        await loadVehicles();
    } catch (error) {
        console.error('Error deleting:', error);
        alert('Error al eliminar: ' + error.message);
    }
}

/**
 * Resetear formulario
 */
function resetForm() {
    const form = document.getElementById('vehicleForm');
    form?.reset();
    editingVehicleId = null;
    uploadedImages = [];

    const title = document.getElementById('formTitle');
    if (title) title.textContent = 'Agregar Vehículo';

    const preview = document.getElementById('imagePreview');
    if (preview) preview.innerHTML = '';
}

/**
 * Cancelar formulario
 */
function cancelForm() {
    resetForm();
    switchToTab('vehicles');
}

// ====================================
// TABS
// ====================================

/**
 * Cambiar de tab
 */
function switchToTab(tabName) {
    // Desactivar todos
    document.querySelectorAll('.admin-tab').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));

    // Activar el seleccionado
    const tabMap = { vehicles: 0, add: 1 };
    const tabIndex = tabMap[tabName] ?? 0;

    const tabs = document.querySelectorAll('.admin-tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs[tabIndex]?.classList.add('active');

    if (tabName === 'vehicles') {
        document.getElementById('vehiclesTab')?.classList.add('active');
    } else if (tabName === 'add') {
        document.getElementById('addTab')?.classList.add('active');
    }

    // Si se va a la lista, resetear el formulario si no está editando
    if (tabName === 'vehicles' && !editingVehicleId) {
        resetForm();
    }
}

// ====================================
// UTILIDADES
// ====================================

/**
 * Detectar tipo de vehículo por nombre
 */
function detectVehicleType(name) {
    if (!name) return 'pickup';
    const nameLower = name.toLowerCase();

    if (/(tahoe|suburban|yukon|expedition|escalade|durango|grand cherokee|4runner|sequoia|explorer|highlander|blazer|telluride)/.test(nameLower)) return 'suv';
    if (/(camaro|mustang|challenger|charger|corvette|hellcat|shelby|gt500|demon|mach 1)/.test(nameLower)) return 'muscle';
    if (/(wrangler|bronco|rubicon|4x4|raptor|trx|zr2|trail boss|badlands|sasquatch)/.test(nameLower)) return 'offroad';
    return 'pickup';
}

/**
 * Formatear moneda
 */
function formatCurrency(value) {
    if (!value) return '$0';
    return '$' + new Intl.NumberFormat('es-CL').format(value);
}

/**
 * Mostrar toast de notificación
 */
function showToast(message) {
    const existing = document.querySelector('.admin-toast');
    existing?.remove();

    const toast = document.createElement('div');
    toast.className = 'admin-toast';
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: var(--black);
        color: white;
        padding: 14px 24px;
        border-radius: 9999px;
        font-size: 14px;
        font-weight: 500;
        z-index: 9999;
        opacity: 0;
        transform: translateY(10px);
        transition: all 0.3s ease;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/* ========================================
   FIN DE ADMIN.JS
   ======================================== */
