// Google Analytics
(function() {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID';
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'GA_MEASUREMENT_ID');
    
    // Función para trackear eventos
    window.trackEvent = function(eventName, eventCategory, eventLabel) {
        if (typeof gtag !== 'undefined') {
            gtag('event', eventName, {
                'event_category': eventCategory,
                'event_label': eventLabel
            });
        }
    };
})();

// Datos completos de vehículos con galerías y kits
window.vehicles = [
    {
        id: 1,
        name: "Chevrolet Silverado 1500 LTZ 2021",
        price: 32900000,
        status: "stock",
        location: "Arica",
        type: "silverado",
        description: "5.3L V8 • 4x4 • Crew Cab • Cuero • Color Gris",
        eta: "Disponible inmediato",
        transitTime: null,
        baseImage: "https://images.unsplash.com/photo-1580274455191-1c62238fa333?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        gallery: [
            "https://images.unsplash.com/photo-1580274455191-1c62238fa333?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1563720223485-8d6d5c5c8b9a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1553440569-bcc63803a83d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1577451550516-7d6e513d1c2b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1590369718314-7c2d4d6cbe2f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1563720223485-8d6d5c5c8b9a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1577451550516-7d6e513d1c2b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        ],
        videoId: "M7FIvfx5J10",
        specifications: {
            motor: "5.3L V8 EcoTec3",
            potencia: "355 HP @ 5600 RPM",
            torque: "383 lb-ft @ 4100 RPM",
            transmision: "Automática 10 velocidades",
            traccion: "4x4 con diferencial trasero bloqueable",
            combustible: "Gasolina",
            consumo: "12.7 L/100km (ciudad) - 9.4 L/100km (carretera)",
            capacidad: "6 pasajeros",
            color: "Gris Summit White",
            kilometraje: "45,000 km"
        },
        kits: [
            {
                id: "silverado_basic",
                name: "Básico",
                level: "basic",
                price: 0,
                description: "Equipamiento de fábrica - Versión original",
                features: ["Llantas standard 18\" aleación", "Audio Chevrolet 7\" con 6 parlantes", "Iluminación halógena completa", "Asientos de tela premium", "Climatizador manual"],
                image: "https://images.unsplash.com/photo-1580274455191-1c62238fa333?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
            },
            {
                id: "silverado_offroad",
                name: "Off-Road",
                level: "offroad",
                price: 3500000,
                description: "Kit aventura extremo para todoterreno",
                features: ["Llantas Fuel 20\" AT negras", "Suspensión elevada 2\" FOX", "Barra LED 30\" CREE", "Winch 12,000 lbs Warn", "Protectores laterales acero", "Step bars tubular"],
                image: "https://images.unsplash.com/photo-1553440569-bcc63803a83d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
            },
            {
                id: "silverado_premium",
                name: "Premium",
                level: "premium",
                price: 4200000,
                description: "Lujo y confort total - Edición exclusiva",
                features: ["Llantas BBS 22\" diamantadas", "Audio Alpine 1200W con subwoofer", "Iluminación LED completa adaptativa", "Asientos ventilados con masaje", "Cámara 360° con grabación", "Revestimiento cromado"],
                image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
            }
        ]
    },
    {
        id: 2,
        name: "Toyota Tacoma TRD Off-Road 2022",
        price: 28500000,
        status: "transit",
        location: "En tránsito",
        type: "tacoma",
        description: "3.5L V6 • 4x4 • TRD Package • Color Blanco",
        eta: "Llega en 15 días",
        transitTime: 15,
        baseImage: "https://images.unsplash.com/photo-1621461133947-f63381c2f7f8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
        gallery: [
            "https://images.unsplash.com/photo-1621461133947-f63381c2f7f8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1576808591885-7045c9d4a5c2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1563720223485-8d6d5c5c8b9a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1553440569-bcc63803a83d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1577451550516-7d6e513d1c2b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
            "https://images.unsplash.com/photo-1590369718314-7c2d4d6cbe2f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
        ],
        videoId: "UeN4AJWnKfs",
        specifications: {
            motor: "3.5L V6 DOHC",
            potencia: "278 HP @ 6000 RPM",
            torque: "265 lb-ft @ 4600 RPM",
            transmision: "Automática 6 velocidades",
            traccion: "4x4 con crawl control",
            combustible: "Gasolina",
            consumo: "13.8 L/100km (ciudad) - 10.2 L/100km (carretera)",
            capacidad: "5 pasajeros",
            color: "Blanco Super White",
            kilometraje: "32,000 km"
        },
        kits: [
            {
                id: "tacoma_basic",
                name: "Básico",
                level: "basic",
                price: 0,
                description: "Configuración TRD estándar - Versión original",
                features: ["TRD Off-Road Package completo", "Audio JBL 8\" con 8 parlantes", "Iluminación LED delantera", "Asientos TRD con logo", "Control de descenso en pendiente"],
                image: "https://images.unsplash.com/photo-1621461133947-f63381c2f7f8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
            },
            {
                id: "tacoma_extreme",
                name: "Extreme",
                level: "extreme",
                price: 2800000,
                description: "Máximo rendimiento off-road - Competencia",
                features: ["Llantas Method 17\" beadlock", "Suspensión FOX 2.5 reservoir", "Protecciones aluminio CBI", "Snorkel Safari", "Luz bar 40\" baja densidad", "Desconectadores barra estabilizadora"],
                image: "https://images.unsplash.com/photo-1576808591885-7045c9d4a5c2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
            },
            {
                id: "tacoma_sport",
                name: "Sport",
                level: "sport",
                price: 2200000,
                description: "Estilo y performance - Edición deportiva",
                features: ["Llantas deportivas 20\" TRD", "Escape deportivo TRD", "Alerón deportivo", "Interiores premium con costuras rojas", "Calcomanías TRD especiales", "Entradas de aire deportivas"],
                image: "https://images.unsplash.com/photo-1563720223485-8d6d5c5c8b9a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
            }
        ]
    }
];
