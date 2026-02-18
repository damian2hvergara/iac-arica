# 🚗 Import American Cars — Guía Completa del Proyecto

## ✅ Estado: FUSIONADO Y LISTO PARA PRODUCCIÓN

Este ZIP contiene el proyecto **unificado**: arquitectura simple del proyecto original, 
con todas las funciones nuevas incorporadas (kits, galería, consultas, share, deep links).

---

## 📦 ESTRUCTURA DE ARCHIVOS

```
import-american-cars/
│
├── index.html          ← Landing page pública (NO modificar estructura)
├── admin.html          ← Panel de administración (login requerido)
├── CNAME               ← Dominio: iac-arica.cl
│
├── css/
│   ├── variables.css   ← Colores, fuentes, espaciados del sistema de diseño
│   ├── components.css  ← Botones, modales, tarjetas, badges reutilizables
│   └── main.css        ← Estilos de secciones: hero, vehículos, footer
│
└── js/
    ├── config.js       ← ⭐ CONFIGURACIÓN CENTRAL (Supabase, Cloudinary, WhatsApp)
    ├── api.js          ← ⭐ CLIENTE DE BASE DE DATOS (todas las queries a Supabase)
    ├── vehicles.js     ← Tarjetas, filtros, modal de detalles, share, deep links
    ├── gallery.js      ← Galería fullscreen con swipe y teclado
    ├── customization.js← Modal de kits de personalización
    ├── consultation.js ← Modal de consultas con FAQs y scoring de leads
    └── admin.js        ← Panel de admin: CRUD vehículos + subida de imágenes
```

---

## ⚙️ CONFIGURACIÓN (config.js)

### Cambiar credenciales de Supabase
```javascript
const SUPABASE_CONFIG = {
    url: 'https://TU-PROYECTO.supabase.co',
    anonKey: 'TU_ANON_KEY'
};
```

### Cambiar Cloudinary
```javascript
const CLOUDINARY_CONFIG = {
    cloudName: 'TU_CLOUD_NAME',
    uploadPreset: 'TU_PRESET',  // Crear en Cloudinary Dashboard → Upload Presets (unsigned)
    folder: 'vehicles'
};
```

### Cambiar WhatsApp / Email
```javascript
const CONTACT_CONFIG = {
    whatsapp: '56938654827',  // Sin + ni espacios
    email: 'contacto@importamericancars.cl',
    instagram: 'importamericancars'
};
```

### Cambiar estados de vehículos
Los labels y colores que aparecen en las tarjetas se definen aquí:
```javascript
vehicleStatuses: {
    stock:   { label: 'En Stock Arica', ... },
    transit: { label: 'En Tránsito',    ... },
    reserve: { label: 'Para Reservar',  ... }
}
```

---

## 🗄️ BASE DE DATOS SUPABASE

### Tablas requeridas

#### `vehicles` (tabla principal)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | Auto-generado |
| name | text | Nombre del vehículo |
| price | integer | Precio en CLP |
| status | text | 'stock', 'transit' o 'reserve' |
| description | text | Descripción |
| type | text | Tipo: pickup, suv, muscle, etc |
| location | text | Ej: "Arica, Chile" |
| eta | text | Texto de disponibilidad |
| transit_time | integer | Días hasta llegada (si está en tránsito) |
| video_id | text | ID de YouTube (si tiene video) |
| motor | text | Ej: "5.3L V8" |
| potencia | text | Ej: "355 HP" |
| torque | text | Ej: "520 Nm" |
| transmision | text | Ej: "Automática 8V" |
| traccion | text | Ej: "4x4" |
| combustible | text | Ej: "Gasolina" |
| consumo | text | Ej: "12 km/L" |
| capacidad | text | Ej: "5 personas" |
| color | text | Color del vehículo |
| kilometraje | text | Ej: "0 km" |
| share_count | integer | Default 0 |
| view_count | integer | Default 0 |
| created_at | timestamp | Auto |

#### `vehicle_images` (imágenes separadas - BD expandida)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | Auto-generado |
| vehicle_id | uuid | FK a vehicles.id (CASCADE DELETE) |
| image_url | text | URL completa de Cloudinary |
| is_main | boolean | Si es la imagen principal |
| order_index | integer | Orden de aparición |

#### `customization_kits` (kits de personalización)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | Auto-generado |
| vehicle_id | uuid | FK a vehicles.id |
| name | text | Nombre del kit |
| level | text | 'basic', 'sport', 'offroad', 'premium', 'extreme' |
| price | integer | Precio adicional en CLP |
| description | text | Descripción del kit |
| image_url | text | Imagen del kit instalado |

#### `kit_features` (características de cada kit)
| Columna | Tipo | Descripción |
|---------|------|-------------|
| id | uuid | Auto-generado |
| kit_id | uuid | FK a customization_kits.id (CASCADE DELETE) |
| feature | text | Ej: "Rines de aleación 22 pulgadas" |
| order_index | integer | Orden de aparición |

### SQL para crear las tablas (pegar en Supabase → SQL Editor)
```sql
-- Tabla principal de vehículos
CREATE TABLE vehicles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'stock' CHECK (status IN ('stock', 'transit', 'reserve')),
  description text,
  type text,
  location text,
  eta text,
  transit_time integer,
  video_id text,
  motor text, potencia text, torque text, transmision text, traccion text,
  combustible text, consumo text, capacidad text, color text, kilometraje text,
  share_count integer DEFAULT 0,
  view_count integer DEFAULT 0,
  created_at timestamp DEFAULT now()
);

-- Imágenes separadas
CREATE TABLE vehicle_images (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  is_main boolean DEFAULT false,
  order_index integer DEFAULT 0
);

-- Kits de personalización
CREATE TABLE customization_kits (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE CASCADE,
  name text NOT NULL,
  level text DEFAULT 'basic',
  price integer DEFAULT 0,
  description text,
  image_url text
);

-- Características de kits
CREATE TABLE kit_features (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  kit_id uuid REFERENCES customization_kits(id) ON DELETE CASCADE,
  feature text NOT NULL,
  order_index integer DEFAULT 0
);

-- Habilitar Row Level Security y acceso público de lectura
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE customization_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lectura pública" ON vehicles FOR SELECT USING (true);
CREATE POLICY "Lectura pública" ON vehicle_images FOR SELECT USING (true);
CREATE POLICY "Lectura pública" ON customization_kits FOR SELECT USING (true);
CREATE POLICY "Lectura pública" ON kit_features FOR SELECT USING (true);
```

---

## 🖼️ CLOUDINARY — CONFIGURAR UPLOAD PRESET

1. Ir a **Cloudinary Dashboard → Settings → Upload**
2. Crear **Upload Preset** del tipo "Unsigned"
3. En el campo `folder`, poner: `vehicles`
4. Copiar el nombre del preset en `config.js → CLOUDINARY_CONFIG.uploadPreset`

---

## 📹 VIDEO DE INSTAGRAM (por qué no se ve como iframe)

Instagram bloqueó los iframes en sitios externos desde 2023.
La solución implementada es un **botón que abre el reel directamente** en Instagram.

Para cambiar el reel del proceso, editar en `consultation.js`:
```javascript
// Buscar la línea:
href="https://www.instagram.com/reel/C6ymBykukrm/"
// Y reemplazar C6ymBykukrm con el ID de tu nuevo reel
```

---

## 🔄 FLUJO: AGREGAR UN VEHÍCULO NUEVO

1. Abrir `admin.html` e iniciar sesión con tu email de Supabase
2. Ir a la pestaña **"Agregar Vehículo"**
3. Completar el formulario (nombre y precio son obligatorios)
4. Subir fotos arrastrándolas o haciendo click en el área
5. Guardar → las fotos se suben a Cloudinary automáticamente
6. El vehículo aparece en el sitio en tiempo real

---

## 🏗️ CÓMO EVOLUCIONAR EL PROYECTO (sin romper nada)

### Regla fundamental
**Un archivo = una responsabilidad.** Si vas a agregar una función nueva, 
identifica en qué archivo va antes de tocar nada.

| Quiero modificar... | Archivo |
|---------------------|---------|
| Credenciales o configs | `config.js` |
| Una query a Supabase | `api.js` |
| Las tarjetas de vehículos | `vehicles.js` |
| El modal de galería de fotos | `gallery.js` |
| El modal de kits (personalizar) | `customization.js` |
| El modal de consultas / FAQs | `consultation.js` |
| El panel admin | `admin.js` + `admin.html` |
| Colores o tipografía global | `variables.css` |
| Botones, badges, modales | `components.css` |
| Hero, secciones, footer | `main.css` |

### Agregar una nueva sección al sitio
1. Agregar el HTML en `index.html`
2. Agregar los estilos en `main.css`
3. Crear un nuevo archivo JS (`mi-seccion.js`) si tiene lógica
4. Incluirlo en `index.html` con `<script src="js/mi-seccion.js"></script>`

### Agregar un campo nuevo a vehículos
1. Agregar la columna en Supabase (SQL Editor)
2. En `api.js → formatVehicle()`, agregar el campo al objeto retornado
3. En `vehicles.js → showVehicleDetails()`, mostrar el campo en el modal
4. En `admin.html`, agregar el input al formulario
5. En `admin.js → handleVehicleSubmit()`, incluir el campo en vehicleData

### Agregar un FAQ nuevo
Solo editar el array `FAQS` en `consultation.js`:
```javascript
{
    id: 'faq-nuevo',
    category: '🆕 Nueva Categoría',
    questions: [
        { q: '¿Pregunta?', a: 'Respuesta.' }
    ]
}
```

---

## 🚀 DEPLOY EN GITHUB PAGES

1. Subir todos los archivos manteniendo la estructura de carpetas
2. En GitHub → Settings → Pages → Source: "Deploy from branch" → `main` → `/ (root)`
3. El CNAME apunta el dominio `iac-arica.cl` automáticamente

---

## ✅ CHECKLIST DE VERIFICACIÓN AL SUBIR

- [ ] La consola del navegador (F12) no muestra errores en rojo
- [ ] Los vehículos cargan en el sitio
- [ ] Las imágenes de los vehículos se ven correctamente
- [ ] El botón "Galería" abre las fotos en pantalla completa
- [ ] El botón "Personalizar" muestra los kits (si el vehículo los tiene)
- [ ] El botón "Consultas" abre el modal con FAQs
- [ ] El botón de Instagram en consultas redirige al reel
- [ ] El botón de WhatsApp abre el chat correctamente
- [ ] El admin.html carga el formulario y la tabla de vehículos
- [ ] Subir una imagen de prueba desde el admin funciona

---

## 📞 DATOS ACTUALES CONFIGURADOS

```
WhatsApp:   +56 9 3865 4827
Email:      contacto@importamericancars.cl
Instagram:  @importamericancars
Dominio:    iac-arica.cl
Supabase:   cflpmluvhfldewiitymh.supabase.co
Cloudinary: df2gprqhp
Analytics:  G-83095XZ965
```

---

*Versión: FUSIONADA — Febrero 2026*
