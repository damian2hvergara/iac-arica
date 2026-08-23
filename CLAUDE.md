# IAC Arica 2026 — Contexto del proyecto

Sitio web + sistema de venta de Stickers Digitales para el sorteo "IAC Arica 2026 — No
sueñes, gánatelo" (Import American Cars). Repo: `damian2hvergara/iac-arica` en GitHub.

## Vault de Obsidian — fuente de verdad de las notas

Este proyecto tiene un vault de Obsidian que coexiste en esta misma carpeta (código + notas
juntos), gitignoreado a propósito (ver `.gitignore`):

- `00-Inbox/` → ideas sueltas, sin procesar (tratar como borrador, no como spec final)
- `01-Arquitectura/` → decisiones de stack, convenciones, ADRs
- `02-Specs/` → especificaciones de features/páginas, una nota por feature
- `03-Modelo-Datos/` → entidades, relaciones, schema de base de datos
- `04-API/` → Edge Functions, contratos request/response
- `05-Progreso/` → bitácora de avance, sesión a sesión

Convenciones globales compartidas con otros proyectos viven un nivel arriba, en
`../_global/` (Templates, Convenciones, Snippets-reutilizables) — no son específicas de
iac-arica.

**Al iniciar cada sesión**, lee `00-Proyecto.md` (misión/visión/objetivos del proyecto,
qué NO es, principios no negociables) y la entrada más reciente de `05-Progreso/` (qué se
hizo últimamente y qué quedó pendiente) — así el contexto de negocio y el estado de avance
no dependen de que el usuario los repita cada vez.

**Antes de proponer o escribir código**, revisa además las notas relevantes del vault
relacionadas al feature/módulo específico en cuestión (`01-Arquitectura/`,
`03-Modelo-Datos/`, `04-API/`, `02-Specs/`). Si una nota contradice el código actual,
señálalo explícitamente antes de continuar — no asumas cuál es la fuente correcta.

**Al terminar una tarea no trivial**, escribe/actualiza vos mismo las notas del vault que
correspondan — no te limites a ofrecerlo, hazlo por defecto (es información local, nunca
se sube a git, así que no hace falta permiso caso a caso):
- Agrega o actualiza la entrada del día en `05-Progreso/` (crear `AAAA-MM-DD.md` si no
  existe todavía uno para hoy; si ya existe, añadir a esa misma nota en vez de crear otra).
- Si se tomó una decisión de arquitectura, se descubrió una trampa/bug de fondo, o cambió
  el modelo de datos/API, refleja eso en la nota correspondiente de `01-Arquitectura/`,
  `03-Modelo-Datos/` o `04-API/` (actualizar la existente si el tema ya está cubierto, no
  duplicar).
- Usa criterio: un typo o un ajuste cosmético no necesita bitácora. Un fix con causa raíz
  no obvia, una feature nueva, o un cambio de modelo de datos, sí.
- Avisa en el chat qué quedó registrado y dónde — la escritura es automática, pero el
  usuario debe poder ver qué se guardó sin tener que abrir Obsidian.

## Stack real (no asumir framework)

- **Frontend**: HTML/CSS/JS planos, sin build step ni framework. `js/config.js` centraliza
  credenciales públicas (Supabase anon key, Mercado Pago public key, Cloudinary). Cachea
  agresivo en el navegador — cada vez que se edite un `.js` compartido, subir el `?v=` en
  el `<script src=...>` de TODOS los HTML que lo cargan.
- **Backend**: Supabase (Postgres + Edge Functions en Deno/TypeScript, `supabase/functions/`).
  Casi toda la lógica vive en funciones SQL `SECURITY DEFINER` (RPCs) llamadas desde el
  frontend con la anon key, protegidas por RLS + `is_admin()`.
- **Pagos**: Mercado Pago (Payment Brick embebido). Antes fue Flow.cl, migrado en la parte 42.
- **Correo**: Resend, vía Edge Functions (`send-stamp-email`, `send-referral-email`,
  `send-referral-nudge`, `send-alert-email`).
- **Imágenes**: Cloudinary.
- **Hosting**: dominio propio `iac-arica.cl` (ver `CNAME`).

## Convención de migraciones — IMPORTANTE

Las migraciones SQL viven en `supabase/migrations/` numeradas como
`2026_sorteo_rebuild_partN_descripcion.sql`, en orden estrictamente creciente (van por la
parte 48 al momento de escribir esto — verificar `ls supabase/migrations/` para el número
real, no asumir). **Este proyecto NUNCA usa `supabase db push`** — la tabla de historial de
migraciones del CLI en remoto está vacía (todo se aplicó a mano). Un `db push` intentaría
re-ejecutar todas las migraciones desde cero sobre datos reales.

**Flujo correcto para cualquier cambio de esquema/función/RPC**: escribir el archivo nuevo
`partN+1_descripcion.sql`, commitear al repo (queda como registro histórico), y pedirle al
usuario que lo pegue y ejecute él mismo en el SQL Editor del dashboard de Supabase. Las
Edge Functions sí se pueden desplegar directo con `supabase functions deploy <nombre>` (no
toca la base de datos, es seguro).

## Bases legales — fuente de verdad del negocio

Las reglas del sorteo (premio, meta mínima, sistema de referidos, ranking de
referenciadores, plazos) están en las bases legales firmadas — el PDF real vive fuera de
este repo, en `C:\Users\damia\OneDrive\Escritorio\Bases_Legales_Sorteo_IAC_Arica_5_actualizado.pdf`
(actualizado 23-08-2026 — reemplazó a la versión firmada 17-08-2026; hay una copia del
texto en `bases.html`, que debe reflejarlo fielmente). Ante cualquier cambio que toque
premios, plazos o condiciones de venta: leer el PDF real primero, nunca inventar términos
legales.

Puntos clave ya vigentes:
- Premio: Dodge Challenger 2018, sorteo por tómbola física.
- Meta mínima: 6.500 Stickers Digitales **comprados** (no cuenta bono ni gratis redes) — es
  un número fijo, no un porcentaje de los emitidos (hubo un error así en `faq.html`,
  corregido el 23-ago).
- Sistema de referidos: cada 4 Compras Referidas = 1 sticker de regalo. Top 3 del Ranking
  de Referenciadores ganan dinero en efectivo: 1° $300.000, 2° $150.000, 3° $50.000.
- **Precio: sin piso legal desde el 23-ago-2026** (antes era $4.500/sticker mínimo en
  packs — cláusula Octava de las bases). El precio queda íntegramente a criterio del
  Organizador; el `CHECK precio_floor` de `packs_config` se eliminó en la parte 48. Los
  únicos límites que quedan son de sanidad de datos (`precio_total > 0`,
  `cantidad_stickers > 0`), no de negocio.
- Venta: se reinició el 23-ago-2026 (antes 17-ago), cierra el 22-sep-2026 (30 días corridos
  desde el reinicio) salvo prórroga por Meta Mínima — ver `sorteo_config.fecha_venta_inicio`
  / `fecha_venta_cierre`, editable también desde stamper-admin.html → Configuración Sorteo.

## Convenciones observadas en el historial de commits

- Mensajes de commit en español, oraciones completas explicando el *por qué*, sin prefijos
  tipo `feat:`/`fix:`.
- Los tipos de orden (`ordenes.tipo`) son: `comprado`, `bonus_referido`, `gratis_redes_sociales`
  — cada bono por referido crea una ORDEN NUEVA con su propio `codigo_referido` (no una fila
  suelta en la orden original), lo que ha causado más de un bug de fragmentación en rankings
  que agrupan por código en vez de por persona (email+RUT normalizados).
