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

**Antes de proponer o escribir código**, revisa las notas relevantes del vault relacionadas
al feature/módulo en cuestión. Si una nota contradice el código actual, señálalo
explícitamente antes de continuar — no asumas cuál es la fuente correcta.

**Al terminar una tarea no trivial**, ofrece un resumen breve en Markdown compatible con
Obsidian (wikilinks `[[nota]]`, tags) para pegar en `05-Progreso/`. Si se tomó una decisión
de arquitectura nueva, ofrece crear una nota en `01-Arquitectura/`.

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
`2026_sorteo_rebuild_partN_descripcion.sql`, en orden estrictamente creciente. **Este
proyecto NUNCA usa `supabase db push`** — la tabla de historial de migraciones del CLI en
remoto está vacía (todo se aplicó a mano). Un `db push` intentaría re-ejecutar las ~45
migraciones desde cero sobre datos reales.

**Flujo correcto para cualquier cambio de esquema/función/RPC**: escribir el archivo nuevo
`partN+1_descripcion.sql`, commitear al repo (queda como registro histórico), y pedirle al
usuario que lo pegue y ejecute él mismo en el SQL Editor del dashboard de Supabase. Las
Edge Functions sí se pueden desplegar directo con `supabase functions deploy <nombre>` (no
toca la base de datos, es seguro).

## Bases legales — fuente de verdad del negocio

Las reglas del sorteo (premio, meta mínima, sistema de referidos, ranking de
referenciadores, plazos) están en las bases legales firmadas — el PDF real vive fuera de
este repo, en `C:\Users\damia\OneDrive\Escritorio\Bases_Legales_Sorteo_IAC_Arica_5.pdf`
(hay una copia del texto en `bases.html`, que debe reflejarlo fielmente). Ante cualquier
cambio que toque premios, plazos o condiciones de venta: leer el PDF real primero, nunca
inventar términos legales.

Puntos clave ya vigentes:
- Premio: Dodge Challenger 2018, sorteo por tómbola física.
- Meta mínima: 6.500 Stickers Digitales **comprados** (no cuenta bono ni gratis redes).
- Sistema de referidos: cada 4 Compras Referidas = 1 sticker de regalo. Top 3 del Ranking
  de Referenciadores ganan dinero en efectivo: 1° $300.000, 2° $150.000, 3° $50.000.
- Precio piso legal: $4.500/sticker en packs (no se puede guardar un pack más barato).

## Convenciones observadas en el historial de commits

- Mensajes de commit en español, oraciones completas explicando el *por qué*, sin prefijos
  tipo `feat:`/`fix:`.
- Los tipos de orden (`ordenes.tipo`) son: `comprado`, `bonus_referido`, `gratis_redes_sociales`
  — cada bono por referido crea una ORDEN NUEVA con su propio `codigo_referido` (no una fila
  suelta en la orden original), lo que ha causado más de un bug de fragmentación en rankings
  que agrupan por código en vez de por persona (email+RUT normalizados).
