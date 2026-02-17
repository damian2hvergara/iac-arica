/* ========================================
   consultation.js - Sistema de Consultas con Video y FAQs
   Filtro inteligente de leads
   ======================================== */

let consultationVehicle = null;
let consultationScore = 0;
let consultationInteractions = [];
let videoWatched = false;
let videoPercentage = 0;
let faqsOpened = [];

// ====================================
// CONFIGURACIÓN DE FAQs
// ====================================
const FAQS = [
    {
        id: 'faq-precio',
        category: '💰 Sobre Precios y Pagos',
        questions: [
            {
                q: '¿El precio incluye fuera de zona franca?',
                a: 'No, el precio publicado es del vehículo para zona franca Iquique, Arica y Magallanes. La liberación tiene un costo adicional que varía según el modelo y año, siempre que cumplas los requisitos legales. Te cotizamos todo de forma transparente.'
            },
            {
                q: '¿Aceptan vehículo en parte de pago?',
                a: 'Sí, aceptamos vehículos en parte de pago. Evaluamos tu vehículo y lo consideramos como parte del pago inicial.'
            },
            {
                q: '¿Tienen financiamiento?',
                a: 'Trabajamos con financiamiento directo. El financiamiento se gestiona una vez confirmada la reserva del vehículo.'
            },
            {
                q: '¿Cuánto es el pie mínimo?',
                a: 'Generalmente trabajamos con un pie del 20-30% del valor total (vehículo + liberación). Esto puede variar según el caso.'
            }
        ]
    },
    {
        id: 'faq-importacion',
        category: '🚢 Sobre Importación',
        questions: [
            {
                q: '¿Cuánto demora el proceso completo?',
                a: 'El proceso completo de un proyecto, salvos los vehiculos en stock, toma entre 45 a 60 días desde el arribo de USA a Chile. Esto incluye liberación.'
            },
            {
                q: '¿Viene con garantía?',
                a: 'Todos nuestros vehículos vienen con garantía mecánica. Además, realizamos inspección pre-entrega completa antes de entregarte tu vehículo.'
            },
            {
                q: '¿Qué documentos necesito?',
                a: 'Necesitas RUT, Cédula de Identidad y certificado de domicilio. Nosotros nos encargamos de todos los trámites de importación y liberación.'
            },
            {
                q: '¿Ustedes hacen todo el trámite?',
                a: 'Sí, nos encargamos de TODO: compra en USA, transporte, trámites aduaneros, liberación y entrega. Tú solo recibes tu vehículo listo para usar.'
            }
        ]
    },
    {
        id: 'faq-vehiculo',
        category: '🔧 Sobre el Vehículo',
        questions: [
            {
                q: '¿Puedo ver el vehículo antes de comprarlo?',
                a: 'Si está en "Stock Arica", sí puedes verlo y probarlo. Si está "En Tránsito", te enviamos fotos y video detallado del vehículo en USA antes de confirmar.'
            },
            {
                q: '¿Tiene algún daño o detalle?',
                a: 'Todos nuestros vehículos son inspeccionados antes de comprarlos. Te enviamos reporte de inspección completo con fotos y cualquier detalle se informa de forma transparente.'
            },
            {
                q: '¿Viene con instrucciones y llaves originales?',
                a: 'Sí, todos incluyen manuales, llaves originales y documentación completa del vehículo.'
            },
            {
                q: '¿Se puede personalizar antes de traerlo?',
                a: 'Sí, ofrecemos kits de personalización profesional que se instalan antes de la entrega. Puedes ver las opciones en el botón "Personalizar" de cada vehículo.'
            }
        ]
    },
    {
        id: 'faq-garantia',
        category: '📋 Sobre Garantías',
        questions: [
            {
                q: '¿Qué garantía tiene el vehículo?',
                a: 'Incluye garantía mecánica de 3 meses o 5.000 km (lo que ocurra primero) en motor y transmisión. Garantía extendida disponible.'
            },
            {
                q: '¿Incluye revisión pre-entrega?',
                a: 'Sí, todos los vehículos pasan por revisión técnica completa, cambio de aceite, filtros y cualquier ajuste necesario antes de entregártelo.'
            },
            {
                q: '¿Qué pasa si tiene algún problema?',
                a: 'Estamos en Arica para cualquier consulta o problema. Además, la garantía cubre reparaciones en talleres autorizados en todo Chile.'
            }
        ]
    },
    {
        id: 'faq-reserva',
        category: '🚗 Sobre Reserva',
        questions: [
            {
                q: '¿Cómo reservo este vehículo?',
                a: 'Contactas con nosotros, acordamos precio y condiciones, y pagas una reserva (generalmente 10% del valor). Así aseguras el vehículo mientras se completa el proceso.'
            },
            {
                q: '¿Cuánto es la reserva?',
                a: 'La reserva es del 10% del valor total acordado. Este monto se descuenta del pago final.'
            },
            {
                q: '¿Es reembolsable la reserva?',
                a: 'La reserva NO es reembolsable una vez confirmada la compra del vehículo en USA, ya que quedamos comprometidos con el proveedor. Antes de eso, se puede evaluar caso a caso.'
            }
        ]
    }
];

// ====================================
// ABRIR MODAL DE CONSULTAS
// ====================================
async function openConsultation(vehicleId) {
    try {
        const vehicle = await vehicleAPI.getVehicle(vehicleId);
        
        if (!vehicle) {
            showError('Vehículo no encontrado');
            return;
        }
        
        consultationVehicle = vehicle;
        consultationScore = 5; // +5 por abrir consultas
        consultationInteractions = ['opened_consultation'];
        videoWatched = false;
        videoPercentage = 0;
        faqsOpened = [];
        
        trackEvent('open', 'Consultation', vehicle.name);
        
        renderConsultationModal();
        
        const modal = document.getElementById('consultationModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            // Iniciar tracking de video después de un momento
            setTimeout(initVideoTracking, 1000);
        }
        
    } catch (error) {
        console.error('Error:', error);
        showError('Error al cargar consultas');
    }
}

// ====================================
// RENDERIZAR MODAL COMPLETO
// ====================================
function renderConsultationModal() {
    const content = document.getElementById('consultationContent');
    if (!content || !consultationVehicle) return;
    
    const isMobile = window.innerWidth <= 768;
    
    content.innerHTML = `
        <div style="max-width: 900px; margin: 0 auto;">
            
            <!-- HEADER -->
            <div style="padding: ${isMobile ? '24px' : '32px'}; border-bottom: var(--border); text-align: center;">
                <div style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; background: var(--import-red-light); border-radius: 20px; margin-bottom: 12px;">
                    <i class="fas fa-question-circle" style="color: var(--import-red); font-size: 12px;"></i>
                    <span style="color: var(--import-red); font-size: 12px; font-weight: 600;">CONSULTAS</span>
                </div>
                
                <h2 style="font-size: ${isMobile ? '24px' : '28px'}; font-weight: 700; margin-bottom: 8px;">
                    ${consultationVehicle.name}
                </h2>
                <p style="color: var(--gray-300); font-size: ${isMobile ? '15px' : '17px'};">
                    Resuelve tus dudas antes de contactarnos
                </p>
            </div>
            
            <!-- VIDEO INSTAGRAM -->
            ${renderVideoSection()}
            
            <!-- FAQs -->
            ${renderFAQSection()}
            
            <!-- PREGUNTA FINAL -->
            ${renderFinalQuestion()}
            
        </div>
    `;
}

// ====================================
// SECCIÓN DE VIDEO
// ====================================
function renderVideoSection() {
    const isMobile = window.innerWidth <= 768;
    
    return `
        <div style="padding: ${isMobile ? '24px' : '32px'}; border-bottom: var(--border); background: var(--gray-50);">
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="font-size: ${isMobile ? '18px' : '21px'}; font-weight: 600; margin-bottom: 8px;">
                    🎥 Conoce Nuestro Proceso
                </h3>
                <p style="color: var(--gray-300); font-size: ${isMobile ? '14px' : '15px'}; max-width: 600px; margin: 0 auto;">
                    Antes de responder tus dudas, mira cómo importamos cada vehículo con total transparencia
                </p>
            </div>
            
            <!-- Video de Instagram -->
            <div style="max-width: 500px; margin: 0 auto; position: relative; border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow-md);">
                <div id="videoContainer" style="position: relative; background: #000;">
                    <iframe 
                        id="instagramVideo"
                        src="https://www.instagram.com/reel/C6ymBykukrm/embed" 
                        width="100%" 
                        height="${isMobile ? '400' : '500'}" 
                        frameborder="0" 
                        scrolling="no" 
                        allowtransparency="true"
                        onload="trackVideoLoad()">
                    </iframe>
                </div>
            </div>
            
            <!-- Stats del video -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 500px; margin: 20px auto 0; padding: 16px; background: var(--white); border-radius: var(--radius); border: var(--border);">
                <div style="text-align: center;">
                    <i class="fas fa-check-circle" style="color: var(--green); font-size: 20px; margin-bottom: 4px;"></i>
                    <div style="font-size: 11px; color: var(--gray-300);">Transparente</div>
                </div>
                <div style="text-align: center;">
                    <i class="fas fa-star" style="color: var(--orange); font-size: 20px; margin-bottom: 4px;"></i>
                    <div style="font-size: 11px; color: var(--gray-300);">+140 Importados</div>
                </div>
                <div style="text-align: center;">
                    <i class="fas fa-shield-alt" style="color: var(--blue); font-size: 20px; margin-bottom: 4px;"></i>
                    <div style="font-size: 11px; color: var(--gray-300);">Con Garantía</div>
                </div>
            </div>
            
            <!-- Botón ver en Instagram -->
            <div style="text-align: center; margin-top: 16px;">
                <a href="https://www.instagram.com/reel/C6ymBykukrm/" 
                   target="_blank" 
                   onclick="trackInteraction('clicked_instagram', 5)"
                   style="display: inline-flex; align-items: center; gap: 8px; color: var(--gray-300); font-size: 13px; text-decoration: none; transition: var(--transition);"
                   onmouseover="this.style.color='var(--import-red)'"
                   onmouseout="this.style.color='var(--gray-300)'">
                    <i class="fab fa-instagram"></i>
                    Ver en Instagram
                </a>
            </div>
        </div>
    `;
}

// ====================================
// SECCIÓN DE FAQs
// ====================================
function renderFAQSection() {
    const isMobile = window.innerWidth <= 768;
    
    return `
        <div style="padding: ${isMobile ? '24px' : '32px'}; border-bottom: var(--border);">
            <div style="text-align: center; margin-bottom: 24px;">
                <h3 style="font-size: ${isMobile ? '18px' : '21px'}; font-weight: 600; margin-bottom: 8px;">
                    ❓ Preguntas Frecuentes
                </h3>
                <p style="color: var(--gray-300); font-size: ${isMobile ? '14px' : '15px'};">
                    Encuentra respuestas rápidas a las dudas más comunes
                </p>
            </div>
            
            <div style="max-width: 700px; margin: 0 auto;">
                ${FAQS.map(category => renderFAQCategory(category)).join('')}
            </div>
        </div>
    `;
}

function renderFAQCategory(category) {
    return `
        <div style="margin-bottom: 24px;">
            <div style="font-size: 15px; font-weight: 600; margin-bottom: 12px; color: var(--black);">
                ${category.category}
            </div>
            ${category.questions.map((q, index) => renderFAQItem(q, `${category.id}-${index}`)).join('')}
        </div>
    `;
}

function renderFAQItem(faq, faqId) {
    return `
        <div class="faq-item" style="margin-bottom: 8px;">
            <button onclick="toggleFAQ('${faqId}')" 
                    class="faq-question"
                    style="width: 100%; text-align: left; padding: 14px 16px; background: var(--white); border: var(--border); border-radius: var(--radius-sm); cursor: pointer; transition: var(--transition); display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                <span style="font-size: 14px; font-weight: 500; color: var(--black);">
                    ${faq.q}
                </span>
                <i class="fas fa-chevron-down" id="icon-${faqId}" style="color: var(--gray-300); font-size: 12px; transition: var(--transition);"></i>
            </button>
            <div id="answer-${faqId}" class="faq-answer" style="display: none; padding: 14px 16px; background: var(--gray-50); border: var(--border); border-top: none; border-radius: 0 0 var(--radius-sm) var(--radius-sm); margin-top: -1px;">
                <p style="font-size: 14px; color: var(--gray-800); line-height: 1.6; margin: 0;">
                    ${faq.a}
                </p>
            </div>
        </div>
    `;
}

// ====================================
// PREGUNTA FINAL
// ====================================
function renderFinalQuestion() {
    const isMobile = window.innerWidth <= 768;
    
    return `
        <div style="padding: ${isMobile ? '24px' : '32px'}; text-align: center; background: var(--gray-50);">
            <h3 style="font-size: ${isMobile ? '18px' : '21px'}; font-weight: 600; margin-bottom: 16px;">
                ¿Resolvimos tus dudas?
            </h3>
            <p style="color: var(--gray-300); font-size: ${isMobile ? '14px' : '15px'}; margin-bottom: 24px; max-width: 500px; margin-left: auto; margin-right: auto;">
                Si quieres más información personalizada sobre este vehículo, podemos ayudarte
            </p>
            
            <div style="display: flex; gap: 12px; justify-content: center; flex-direction: ${isMobile ? 'column' : 'row'}; max-width: 500px; margin: 0 auto;">
                <button onclick="contactExecutive()" 
                        class="button"
                        style="flex: 1; padding: 16px 24px; font-size: 15px; min-width: ${isMobile ? 'auto' : '200px'};">
                    <i class="fab fa-whatsapp"></i> Sí, quiero hablar con un ejecutivo
                </button>
                <button onclick="declineContact()" 
                        class="button button-outline"
                        style="flex: 1; padding: 16px 24px; font-size: 15px; min-width: ${isMobile ? 'auto' : '200px'};">
                    No, solo estaba consultando
                </button>
            </div>
        </div>
    `;
}

// ====================================
// TOGGLE FAQ
// ====================================
function toggleFAQ(faqId) {
    const answer = document.getElementById(`answer-${faqId}`);
    const icon = document.getElementById(`icon-${faqId}`);
    
    if (!answer || !icon) return;
    
    const isOpen = answer.style.display === 'block';
    
    if (isOpen) {
        answer.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
    } else {
        answer.style.display = 'block';
        icon.style.transform = 'rotate(180deg)';
        
        // Tracking
        if (!faqsOpened.includes(faqId)) {
            faqsOpened.push(faqId);
            consultationScore += 3; // +3 por cada FAQ abierta
            consultationInteractions.push(`opened_faq_${faqId}`);
            
            trackEvent('open', 'FAQ', faqId);
            console.log(`📊 FAQ abierta: ${faqId} | Score: ${consultationScore}`);
        }
    }
}

// ====================================
// VIDEO TRACKING
// ====================================
function trackVideoLoad() {
    trackInteraction('video_loaded', 5);
    console.log('📹 Video cargado');
}

function initVideoTracking() {
    // Tracking básico: si pasa 10 segundos con el modal abierto, asumimos que vio el video
    setTimeout(() => {
        if (document.getElementById('consultationModal')?.classList.contains('active')) {
            videoWatched = true;
            videoPercentage = 50;
            consultationScore += 10; // +10 por ver video
            consultationInteractions.push('watched_video');
            
            trackEvent('watch', 'Video', '50%');
            console.log('📹 Usuario vio video | Score: ' + consultationScore);
        }
    }, 10000);
    
    // Si pasa 30 segundos, asumimos que vio completo
    setTimeout(() => {
        if (document.getElementById('consultationModal')?.classList.contains('active')) {
            videoPercentage = 100;
            consultationScore += 5; // +5 adicional por ver completo
            
            trackEvent('watch', 'Video', '100%');
            console.log('📹 Usuario vio video completo | Score: ' + consultationScore);
        }
    }, 30000);
}

// ====================================
// CONTACTAR EJECUTIVO
// ====================================
function contactExecutive() {
    if (!consultationVehicle) return;
    
    // Score final
    consultationScore += 20; // +20 por contactar
    consultationInteractions.push('contacted_executive');
    
    // Preparar mensaje para WhatsApp
    let message = `Hola, tengo consultas sobre:%0A%0A`;
    message += `🚗 ${consultationVehicle.name}%0A`;
    message += `💰 Precio: $${formatPrice(consultationVehicle.price)} CLP%0A`;
    message += `📍 Estado: ${APP_CONFIG.vehicleStatuses[consultationVehicle.status].label}%0A%0A`;
    
    // Agregar información de interacción
    const engagement = getEngagementLevel();
    if (videoWatched) {
        message += `✅ Vi el video del proceso%0A`;
    }
    if (faqsOpened.length > 0) {
        message += `✅ Leí ${faqsOpened.length} preguntas frecuentes%0A`;
    }
    message += `%0AQuisiera hablar con un ejecutivo para más información.`;
    
    // Tracking
    trackEvent('contact', 'Executive', consultationVehicle.name);
    trackEvent('engagement', 'Consultation', engagement);
    console.log(`📞 LEAD CALIFICADO | Score: ${consultationScore} | Engagement: ${engagement}`);
    console.log('Interacciones:', consultationInteractions);
    
    // Cerrar modal y abrir WhatsApp
    closeConsultation();
    
    setTimeout(() => {
        window.open(`https://wa.me/56938654827?text=${message}`, '_blank');
    }, 300);
}

// ====================================
// DECLINAR CONTACTO
// ====================================
function declineContact() {
    consultationInteractions.push('declined_contact');
    
    trackEvent('decline', 'Consultation', consultationVehicle?.name || 'Unknown');
    console.log(`❌ Lead no interesado | Score: ${consultationScore}`);
    console.log('Interacciones:', consultationInteractions);
    
    // Mostrar mensaje de agradecimiento
    const content = document.getElementById('consultationContent');
    if (content) {
        content.innerHTML = `
            <div style="padding: 60px 24px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 16px;">
                    👍
                </div>
                <h3 style="font-size: 24px; font-weight: 600; margin-bottom: 12px;">
                    ¡Perfecto!
                </h3>
                <p style="color: var(--gray-300); font-size: 17px; max-width: 400px; margin: 0 auto 24px;">
                    Si cambias de opinión o tienes más consultas, estamos disponibles.
                </p>
                <button onclick="closeConsultation()" class="button button-outline">
                    Cerrar
                </button>
            </div>
        `;
    }
    
    // Auto-cerrar después de 3 segundos
    setTimeout(() => {
        closeConsultation();
    }, 3000);
}

// ====================================
// CERRAR MODAL
// ====================================
function closeConsultation() {
    const modal = document.getElementById('consultationModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
    
    // Log final
    if (consultationScore > 0) {
        console.log('📊 Sesión de consulta finalizada:');
        console.log('  - Score total:', consultationScore);
        console.log('  - Video visto:', videoWatched, videoPercentage + '%');
        console.log('  - FAQs abiertas:', faqsOpened.length);
        console.log('  - Engagement:', getEngagementLevel());
    }
    
    // Reset
    consultationVehicle = null;
    consultationScore = 0;
    consultationInteractions = [];
    videoWatched = false;
    videoPercentage = 0;
    faqsOpened = [];
}

// ====================================
// UTILIDADES
// ====================================
function trackInteraction(action, points = 0) {
    consultationScore += points;
    consultationInteractions.push(action);
    console.log(`✅ ${action} | +${points} | Score: ${consultationScore}`);
}

function getEngagementLevel() {
    if (consultationScore >= 40) return 'Very High';
    if (consultationScore >= 25) return 'High';
    if (consultationScore >= 15) return 'Medium';
    if (consultationScore >= 5) return 'Low';
    return 'None';
}

// ====================================
// EXPORT
// ====================================
if (typeof window !== 'undefined') {
    window.openConsultation = openConsultation;
    window.closeConsultation = closeConsultation;
    window.toggleFAQ = toggleFAQ;
    window.contactExecutive = contactExecutive;
    window.declineContact = declineContact;
    window.trackVideoLoad = trackVideoLoad;
    window.trackInteraction = trackInteraction;
}

console.log('✅ Consultation.js cargado - Sistema de calificación de leads activo');
