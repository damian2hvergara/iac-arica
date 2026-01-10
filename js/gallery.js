// Galería Instagram (TU CÓDIGO ORIGINAL COMPLETO)

function openInstagramGallery(vehicleId) {
    const vehicle = DataLoader.getVehicleById(vehicleId);
    if (!vehicle || !vehicle.gallery || vehicle.gallery.length === 0) {
        console.log('No hay galería para este vehículo');
        return;
    }
    
    currentInstagramGallery = vehicle;
    currentInstagramSlide = 0;
    
    trackEvent('open', 'Gallery', vehicle.name);
    
    const modal = document.getElementById('instagramGalleryModal');
    const slidesContainer = document.getElementById('gallerySlidesContainer');
    const dotsContainer = document.getElementById('galleryDots');
    
    if (!modal || !slidesContainer || !dotsContainer) return;
    
    // Crear slides
    slidesContainer.innerHTML = vehicle.gallery.map((img, index) => 
        `<div class="gallery-slide ${index === 0 ? 'active' : ''}">
            <img src="${img}" alt="${vehicle.name} - Imagen ${index + 1}" 
                 onclick="toggleZoom(this)"
                 ondblclick="toggleZoom(this)"
                 loading="lazy">
        </div>`
    ).join('');
    
    // Crear dots solo si hay más de 1 imagen
    if (vehicle.gallery.length > 1) {
        dotsContainer.innerHTML = vehicle.gallery.map((_, index) => 
            `<div class="gallery-dot ${index === 0 ? 'active' : ''}" onclick="goToSlide(${index})"></div>`
        ).join('');
        dotsContainer.style.display = 'flex';
    } else {
        dotsContainer.style.display = 'none';
    }
    
    // Actualizar contador
    updateGalleryCounter();
    
    // Mostrar modal
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function changeGallerySlide(direction) {
    if (!currentInstagramGallery || !currentInstagramGallery.gallery) return;
    
    const slides = document.querySelectorAll('.gallery-slide');
    const dots = document.querySelectorAll('.gallery-dot');
    
    if (slides.length === 0) return;
    
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
    if (dots.length > 0) {
        dots[currentInstagramSlide]?.classList.remove('active');
        dots[newIndex]?.classList.add('active');
    }
    
    currentInstagramSlide = newIndex;
    updateGalleryCounter();
    
    trackEvent('navigation', 'Gallery', `Slide ${newIndex + 1}`);
}

function goToSlide(index) {
    if (!currentInstagramGallery || !currentInstagramGallery.gallery) return;
    
    const slides = document.querySelectorAll('.gallery-slide');
    const dots = document.querySelectorAll('.gallery-dot');
    
    if (slides.length === 0 || index < 0 || index >= slides.length) return;
    
    // Quitar zoom si está activo
    const currentSlide = slides[currentInstagramSlide];
    if (currentSlide) {
        const img = currentSlide.querySelector('img');
        if (img && img.classList.contains('zoomed')) {
            img.classList.remove('zoomed');
        }
    }
    
    // Actualizar slides
    slides[currentInstagramSlide]?.classList.remove('active');
    slides[index]?.classList.add('active');
    
    // Actualizar dots
    if (dots.length > 0) {
        dots[currentInstagramSlide]?.classList.remove('active');
        dots[index]?.classList.add('active');
    }
    
    currentInstagramSlide = index;
    updateGalleryCounter();
}

function toggleZoom(imgElement) {
    if (!imgElement) return;
    imgElement.classList.toggle('zoomed');
    trackEvent('zoom', 'Gallery', imgElement.classList.contains('zoomed') ? 'Zoom In' : 'Zoom Out');
}

function updateGalleryCounter() {
    if (!currentInstagramGallery || !currentInstagramGallery.gallery) return;
    
    const counter = document.getElementById('galleryCounter');
    if (counter) {
        counter.textContent = `${currentInstagramSlide + 1} / ${currentInstagramGallery.gallery.length}`;
    }
}

function closeInstagramGallery() {
    const modal = document.getElementById('instagramGalleryModal');
    if (!modal) return;
    
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

// Hacer disponibles globalmente
window.openInstagramGallery = openInstagramGallery;
window.changeGallerySlide = changeGallerySlide;
window.goToSlide = goToSlide;
window.toggleZoom = toggleZoom;
window.closeInstagramGallery = closeInstagramGallery;
