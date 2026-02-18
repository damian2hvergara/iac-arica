/* ========================================
   testimonials.js — Entregas reales con foto,
   cita, avatar y link a Instagram
   
   Estrategia:
   - Intenta cargar desde tabla 'deliveries' en Supabase
   - Si la tabla no existe aún → los testimonios
     estáticos del HTML siguen visibles (no rompe nada)
   - Cuando creas la tabla y agregas datos, se
     reemplaza automáticamente con las entregas reales
   ======================================== */

class TestimonialsSystem {
    constructor() {
        this.loaded = false;
    }

    async init() {
        if (this.loaded) return;
        try {
            const { data, error } = await vehicleAPI.client
                .from('deliveries')
                .select('*')
                .eq('visible', true)
                .order('delivery_date', { ascending: false })
                .limit(6);

            // Si la tabla no existe todavía, el HTML estático sigue visible
            if (error || !data || data.length === 0) {
                console.log('testimonials: usando datos estáticos del HTML');
                return;
            }

            // Hay datos en Supabase → reemplazar la sección completa
            this._render(data);
            this.loaded = true;
        } catch (err) {
            console.warn('testimonials: tabla no disponible aún', err.message);
        }
    }

    // ── Reemplaza la sección entera de testimonios ────────
    _render(deliveries) {
        const section = document.getElementById('testimonials');
        if (!section) return;

        section.innerHTML = `
        <div class="section-container">
            <h2 class="section-title">Entregas Recientes</h2>
            <p class="section-subtitle">Clientes reales, vehículos reales</p>

            <div class="deliveries-grid" id="deliveriesGrid">
                ${deliveries.map(d => this._card(d)).join('')}
            </div>
        </div>`;
    }

    // ── Tarjeta individual de entrega ─────────────────────
    _card(d) {
        const img = d.vehicle_image || d.photo_url || '';
        const avatar = d.client_avatar || '';
        const name   = d.client_name  || 'Cliente';
        const city   = d.client_city  || '';
        const date   = d.delivery_date ? this._fmtDate(d.delivery_date) : '';
        const meta   = [city, date].filter(Boolean).join(' · ');

        return `
        <article class="delivery-card">
            ${img ? `
            <div class="delivery-image">
                <img src="${img}" alt="${d.vehicle_name || 'Entrega'}" loading="lazy"
                     onerror="this.parentElement.style.display='none'">
                ${d.is_verified ? `
                <div class="verified-badge">
                    <i class="fas fa-check-circle"></i> Compra verificada
                </div>` : ''}
            </div>` : ''}

            <div class="delivery-body">
                ${d.vehicle_name ? `<p class="delivery-vehicle">${d.vehicle_name}</p>` : ''}
                ${(d.quote || d.comment) ? `<p class="delivery-quote">"${d.quote || d.comment}"</p>` : ''}

                <div class="delivery-author">
                    ${avatar ? `<img src="${avatar}" alt="${name}" class="delivery-author-avatar"
                                     onerror="this.style.display='none'">` : ''}
                    <div>
                        <p class="delivery-author-name">${name}</p>
                        ${meta ? `<p class="delivery-author-meta">${meta}</p>` : ''}
                    </div>
                </div>

                ${d.instagram_url ? `
                <a href="${d.instagram_url}" target="_blank" rel="noopener"
                   class="delivery-social"
                   onclick="trackEvent('testimonial_instagram','Testimonials','${name}')">
                    <i class="fab fa-instagram"></i> Ver entrega en Instagram
                </a>` : ''}
            </div>
        </article>`;
    }

    _fmtDate(str) {
        try {
            return new Date(str).toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
        } catch { return ''; }
    }
}

const testimonialsSystem = new TestimonialsSystem();
window.testimonialsSystem = testimonialsSystem;

console.log('✅ testimonials.js cargado');
