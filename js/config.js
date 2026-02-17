/* ========================================
   config.js - Configuración Central
   Import American Cars
   ======================================== */

const APP_CONFIG = {
    // ====================================
    // SUPABASE
    // ====================================
    supabase: {
        url: 'https://nvroeevlxsrfqxkamxdn.supabase.co',
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im52cm9lZXZseHNyZnF4a2FteGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkzMTY5ODYsImV4cCI6MjA2NDg5Mjk4Nn0.cP1KYLij4sMDK8SfrJWfpK3dJHccRkLopP0dQHSP8Yk'
    },

    // ====================================
    // WHATSAPP
    // ====================================
    whatsapp: {
        number: '56938654827',
        defaultMessage: 'Hola, estoy interesado en importar un vehículo desde USA. ¿Podrían asesorarme?',
        vehicleMessage: (vehicle) => `Hola, me interesa el ${vehicle.name} (${vehicle.year}) que vi en su sitio web. ¿Podrían darme más información?`
    },

    // ====================================
    // TIPOS DE VEHÍCULOS
    // ====================================
    vehicleTypes: {
        all: {
            id: 'all',
            label: 'Todos',
            keywords: []
        },
        pickup: {
            id: 'pickup',
            label: 'Pickups',
            keywords: ['silverado', 'ram', 'f-150', 'f150', 'ford f', 'sierra', 'titan', 'tundra', 'colorado', 'ranger', 'tacoma', 'frontier', 'gladiator', 'ridgeline', 'maverick', 'santa cruz']
        },
        suv: {
            id: 'suv',
            label: 'SUV',
            keywords: ['tahoe', 'suburban', 'yukon', 'expedition', 'navigator', 'escalade', 'durango', 'grand cherokee', '4runner', 'sequoia', 'armada', 'pathfinder', 'pilot', 'highlander', 'telluride', 'palisade', 'explorer', 'traverse', 'blazer']
        },
        muscle: {
            id: 'muscle',
            label: 'Muscle Cars',
            keywords: ['camaro', 'mustang', 'challenger', 'charger', 'corvette', 'hellcat', 'gt500', 'shelby', 'ss', 'zl1', 'srt', 'demon', 'mach 1', 'bullitt', 'gt350']
        },
        offroad: {
            id: 'offroad',
            label: 'Off-Road',
            keywords: ['jeep', 'wrangler', 'bronco', 'rubicon', '4x4', 'raptor', 'trx', 'zr2', 'trail boss', 'rebel', 'mojave', 'sasquatch', 'wildtrak', 'tremor', 'badlands']
        }
    },

    // ====================================
    // ESTADOS DE VEHÍCULOS
    // ====================================
    vehicleStatus: {
        stock: {
            id: 'stock',
            label: 'En stock',
            color: 'green',
            description: 'Listo para entregar'
        },
        transit: {
            id: 'transit',
            label: 'En tránsito',
            color: 'blue',
            description: 'En camino desde USA'
        },
        reserve: {
            id: 'reserve',
            label: 'Reservar',
            color: 'orange',
            description: 'Disponible para reserva'
        },
        customizable: {
            id: 'customizable',
            label: 'Personalizable',
            color: 'purple',
            description: 'Configura a tu gusto'
        }
    },

    // ====================================
    // CONFIGURACIÓN DE COMPARTIR
    // ====================================
    share: {
        baseUrl: 'https://importamericancars.cl',
        buildUrl: (vehicleId) => `${APP_CONFIG.share.baseUrl}/vehiculo/${vehicleId}`,
        buildText: (vehicle) => `¡Mira este ${vehicle.name} que encontré! Importado desde USA por Import American Cars.`,
        platforms: {
            whatsapp: {
                name: 'WhatsApp',
                icon: 'fab fa-whatsapp',
                buildUrl: (text, url) => `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`
            },
            facebook: {
                name: 'Facebook',
                icon: 'fab fa-facebook-f',
                buildUrl: (text, url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
            },
            twitter: {
                name: 'Twitter',
                icon: 'fab fa-twitter',
                buildUrl: (text, url) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
            }
        }
    },

    // ====================================
    // CONFIGURACIÓN DE NOTIFICACIONES
    // ====================================
    notifications: {
        enabled: true,
        initialDelay: 5000,      // 5 segundos antes de la primera
        displayDuration: 6000,   // Mostrar por 6 segundos
        interval: 30000,         // Nueva cada 30 segundos
        actions: {
            reservation: {
                verb: 'reservó',
                icon: 'fas fa-calendar-check'
            },
            inquiry: {
                verb: 'consultó por',
                icon: 'fas fa-comment'
            },
            delivery: {
                verb: 'recibió su',
                icon: 'fas fa-truck'
            },
            view: {
                verb: 'está viendo',
                icon: 'fas fa-eye'
            }
        }
    },

    // ====================================
    // CONFIGURACIÓN DE CONSULTAS
    // ====================================
    consultation: {
        videoUrl: 'https://www.youtube.com/embed/TU_VIDEO_ID',
        advisor: {
            name: 'Carlos',
            avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100',
            role: 'Asesor de Importación'
        }
    },

    // ====================================
    // KITS DE PERSONALIZACIÓN
    // ====================================
    customizationKits: {
        chrome: {
            id: 'chrome',
            name: 'Kit Chrome Deluxe',
            price: 890000,
            image: 'https://res.cloudinary.com/df2gprqhp/image/upload/v1749854376/chrome_hb27cq.jpg',
            description: 'Molduras cromadas premium, manillas y espejos'
        },
        blackout: {
            id: 'blackout',
            name: 'Kit Blackout Total',
            price: 750000,
            image: 'https://res.cloudinary.com/df2gprqhp/image/upload/v1749854376/blackout_tguprj.jpg',
            description: 'Emblemas, parrilla y detalles en negro mate'
        },
        offroad: {
            id: 'offroad',
            name: 'Kit Off-Road Pro',
            price: 1200000,
            image: 'https://res.cloudinary.com/df2gprqhp/image/upload/v1749854376/offroad_rqykxs.jpg',
            description: 'Protectores, estribos y barra LED'
        },
        interior: {
            id: 'interior',
            name: 'Kit Interior Premium',
            price: 650000,
            image: 'https://res.cloudinary.com/df2gprqhp/image/upload/v1749854376/interior_ld7yzz.jpg',
            description: 'Tapetes, forros de asientos y volante deportivo'
        }
    },

    // ====================================
    // CLOUDINARY
    // ====================================
    cloudinary: {
        cloudName: 'df2gprqhp',
        uploadPreset: 'import_cars_unsigned',
        folder: 'vehicles'
    },

    // ====================================
    // GOOGLE ANALYTICS
    // ====================================
    analytics: {
        enabled: true,
        trackingId: 'G-XXXXXXXXXX', // Reemplazar con tu ID real
        events: {
            viewVehicle: 'view_vehicle',
            filterType: 'filter_type',
            filterStatus: 'filter_status',
            openConsult: 'open_consult',
            watchVideo: 'watch_video',
            viewFaqs: 'view_faqs',
            contactWhatsapp: 'contact_whatsapp',
            shareVehicle: 'share_vehicle',
            openGallery: 'open_gallery',
            customizeVehicle: 'customize_vehicle'
        }
    },

    // ====================================
    // FORMATEO
    // ====================================
    format: {
        currency: (value) => {
            if (!value) return '$0';
            return '$' + new Intl.NumberFormat('es-CL').format(value);
        },
        date: (dateString) => {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleDateString('es-CL', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        },
        shortDate: (dateString) => {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleDateString('es-CL', {
                month: 'short',
                year: 'numeric'
            });
        },
        timeAgo: (dateString) => {
            const date = new Date(dateString);
            const now = new Date();
            const seconds = Math.floor((now - date) / 1000);
            
            if (seconds < 60) return 'Hace un momento';
            if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
            if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} horas`;
            if (seconds < 604800) return `Hace ${Math.floor(seconds / 86400)} días`;
            return APP_CONFIG.format.shortDate(dateString);
        }
    },

    // ====================================
    // MENSAJES
    // ====================================
    messages: {
        loading: 'Cargando...',
        error: 'Ha ocurrido un error. Por favor, intenta nuevamente.',
        noVehicles: 'No hay vehículos disponibles en esta categoría.',
        copied: '¡Enlace copiado!',
        shared: '¡Gracias por compartir!'
    }
};

// Hacer disponible globalmente
window.APP_CONFIG = APP_CONFIG;

/* ========================================
   FIN DE CONFIG.JS
   ======================================== */
