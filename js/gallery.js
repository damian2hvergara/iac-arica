/* ========================================
   gallery.js - Galería tipo Instagram
   ======================================== */

let currentGallery = [];
let currentSlideIndex = 0;
let currentGalleryVehicle = null;

// ABRIR GALERÍA
async function openGallery(vehicleId) {
    try {
        const vehicle = await vehicleAPI.getVehicle(vehicleId);
        
        if (!vehicle || !vehicle.gallery || vehicle.gallery.length === 0) {
            showNotification('Este vehículo no tiene imágenes', 'error');
            return;
        }
        
        currentGallery = vehicle.gallery;
        currentGalleryVehicle = vehicle;
        currentSlideIndex = 0;
        
        trackEvent('open', 'Gallery', vehicle.name);
        
        renderGallery();
        
        const modal = document.getElementById('galleryModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
        
    } catch (error) {
        console.error('Error:', error);
        showError('Error al cargar galería');
    }
}

// RENDERIZAR GALERÍA
function renderGallery() {
    const slidesContainer = document.getElementById('gallerySlides');
    const dotsContainer = document.getElementById('galleryDots');
    const counterElement = document.getElementById('galleryCounter');
    
    if (!slidesContainer || !dotsContainer) return;
    
    slidesContainer.innerHTML = currentGallery.map((img, index) => `
        <div class="gallery-slide ${index === currentSlideIndex ? 'active' : ''}">
            <img src="${img}" 
                 alt="${currentGalleryVehicle ? currentGalleryVehicle.name : 'Imagen'} - ${index + 1}" 
                 loading="lazy"
                 ondblclick="toggleZoom(this)">
        </div>
    `).join('');
    
    dotsContainer.innerHTML = currentGallery.map((_, index) => `
        <div class="gallery-dot ${index === currentSlideIndex ? 'active' : ''}" 
             onclick="goToSlide(${index})"></div>
    `).join('');
    
    updateGalleryCounter();
}

// NAVEGACIÓN
function changeSlide(direction) {
    if (currentGallery.length === 0) return;
    
    const currentSlide = document.querySelector('.gallery-slide.active img');
    if (currentSlide && currentSlide.style.transform) {
        currentSlide.style.transform = '';
        currentSlide.style.cursor = 'zoom-in';
    }
    
    const newIndex = (currentSlideIndex + direction + currentGallery.length) % currentGallery.length;
    
    const slides = document.querySelectorAll('.gallery-slide');
    const dots = document.querySelectorAll('.gallery-dot');
    
    slides[currentSlideIndex].classList.remove('active');
    slides[newIndex].classList.add('active');
    
    dots[currentSlideIndex].classList.remove('active');
    dots[newIndex].classList.add('active');
    
    currentSlideIndex = newIndex;
    updateGalleryCounter();
    
    trackEvent('navigation', 'Gallery', `Slide ${newIndex + 1}`);
}

function goToSlide(index) {
    if (index === currentSlideIndex) return;
    
    const direction = index > currentSlideIndex ? 1 : -1;
    const diff = Math.abs(index - currentSlideIndex);
    
    for (let i = 0; i < diff; i++) {
        changeSlide(direction);
    }
}

// ZOOM
function toggleZoom(imgElement) {
    if (!imgElement) return;
    
    const isZoomed = imgElement.style.transform === 'scale(1.5)';
    
    if (isZoomed) {
        imgElement.style.transform = '';
        imgElement.style.cursor = 'zoom-in';
        trackEvent('zoom', 'Gallery', 'Zoom Out');
    } else {
        imgElement.style.transform = 'scale(1.5)';
        imgElement.style.cursor = 'zoom-out';
        trackEvent('zoom', 'Gallery', 'Zoom In');
    }
}

// CONTADOR
function updateGalleryCounter() {
    const counterElement = document.getElementById('galleryCounter');
    if (counterElement) {
        counterElement.textContent = `${currentSlideIndex + 1} / ${currentGallery.length}`;
    }
}

// CERRAR
function closeGallery() {
    const modal = document.getElementById('galleryModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
    
    currentGallery = [];
    currentSlideIndex = 0;
    currentGalleryVehicle = null;
}

// TECLADO
document.addEventListener('keydown', (e) => {
    const galleryModal = document.getElementById('galleryModal');
    if (!galleryModal || !galleryModal.classList.contains('active')) return;
    
    switch(e.key) {
        case 'ArrowLeft':
            changeSlide(-1);
            break;
        case 'ArrowRight':
            changeSlide(1);
            break;
        case 'Escape':
            closeGallery();
            break;
        case ' ':
            e.preventDefault();
            const currentImg = document.querySelector('.gallery-slide.active img');
            if (currentImg) toggleZoom(currentImg);
            break;
    }
});

// TOUCH/SWIPE
let touchStartX = 0;
let touchEndX = 0;

function handleGesture() {
    const swipeThreshold = 50;
    
    if (touchEndX < touchStartX - swipeThreshold) {
        changeSlide(1);
    }
    
    if (touchEndX > touchStartX + swipeThreshold) {
        changeSlide(-1);
    }
}

document.addEventListener('touchstart', (e) => {
    const galleryModal = document.getElementById('galleryModal');
    if (!galleryModal || !galleryModal.classList.contains('active')) return;
    
    touchStartX = e.changedTouches[0].screenX;
});

document.addEventListener('touchend', (e) => {
    const galleryModal = document.getElementById('galleryModal');
    if (!galleryModal || !galleryModal.classList.contains('active')) return;
    
    touchEndX = e.changedTouches[0].screenX;
    handleGesture();
});

console.log('✅ Gallery.js cargado');
