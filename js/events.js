// Eventos y cierre de modales

document.addEventListener('DOMContentLoaded', () => {
    // Botón de simulación
    const simulateBtn = document.getElementById('simulateCustomization');
    if (simulateBtn) {
        simulateBtn.addEventListener('click', showCustomizationModal);
    }
    
    // Cerrar modales
    const closeDetailsBtn = document.getElementById('closeDetailsModal');
    const closeCustomizationBtn = document.getElementById('closeCustomizationModal');
    const closeGalleryBtn = document.getElementById('closeGalleryModal');
    
    if (closeDetailsBtn) closeDetailsBtn.addEventListener('click', closeVehicleDetailsModal);
    if (closeCustomizationBtn) closeCustomizationBtn.addEventListener('click', closeCustomizationModal);
    if (closeGalleryBtn) closeGalleryBtn.addEventListener('click', closeInstagramGallery);
    
    // Navegación galería
    const prevSlideBtn = document.getElementById('prevSlide');
    const nextSlideBtn = document.getElementById('nextSlide');
    
    if (prevSlideBtn) prevSlideBtn.addEventListener('click', () => changeGallerySlide(-1));
    if (nextSlideBtn) nextSlideBtn.addEventListener('click', () => changeGallerySlide(1));
    
    // Cerrar modales al hacer click fuera
    document.addEventListener('click', (e) => {
        const detailsModal = document.getElementById('vehicleDetailsModal');
        const customizationModal = document.getElementById('customizationModal');
        const galleryModal = document.getElementById('instagramGalleryModal');
        
        if (detailsModal && e.target === detailsModal) closeVehicleDetailsModal();
        if (customizationModal && e.target === customizationModal) closeCustomizationModal();
        if (galleryModal && e.target === galleryModal) closeInstagramGallery();
    });
    
    // Cerrar con ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeVehicleDetailsModal();
            closeCustomizationModal();
            closeInstagramGallery();
        }
    });
    
    // Tracking de navegación
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function() {
            const label = this.dataset.track || this.textContent;
            trackEvent('click', 'Navigation', label);
        });
    });
    
    // Tracking de redes sociales
    document.querySelectorAll('[data-track]').forEach(el => {
        if (el.tagName === 'A' && (el.href.includes('instagram') || el.href.includes('drive.google'))) {
            el.addEventListener('click', function() {
                const label = this.dataset.track;
                if (this.href.includes('instagram')) {
                    trackEvent('click', 'Social', label);
                } else if (this.href.includes('drive.google')) {
                    trackEvent('download', 'PDF', label);
                }
            });
        }
    });
});

// Tracking de scroll (opcional)
let scrollTracked = [false, false, false, false];
window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;
    const scrollPercent = (scrollTop / (docHeight - windowHeight)) * 100;
    
    const thresholds = [25, 50, 75, 95];
    thresholds.forEach((threshold, i) => {
        if (scrollPercent >= threshold && !scrollTracked[i]) {
            trackEvent('scroll', 'Engagement', `${threshold}%`);
            scrollTracked[i] = true;
        }
    });
});
