-- ============================================================
-- IAC ARICA 2026 — Parte 46 (RESET manual, no migración de esquema)
-- Vacía todas las órdenes y estampillas (todas eran de prueba, según
-- confirmó el Organizador) para arrancar en 0 justo antes de la venta
-- real. NO toca vehicles, packs_config, admin_emails, ni la fila de
-- sorteo_config (salvo el contador manual total_stickers_emitidos,
-- que se resetea a 0 para que quede consistente con las 0 órdenes
-- que quedan).
--
-- system_events (logs de monitoreo/seguridad) se deja intacto a
-- propósito — es historial operativo, no "ventas".
--
-- Este archivo es un registro de lo que se ejecutó, no una migración
-- de esquema — TRUNCATE es seguro de correr una sola vez; volver a
-- correrlo después de que haya ventas reales borraría ventas reales,
-- así que NO reutilizar este archivo más adelante.
-- ============================================================

TRUNCATE TABLE estampillas, ordenes RESTART IDENTITY CASCADE;

UPDATE sorteo_config SET total_stickers_emitidos = 0 WHERE activo = true;

NOTIFY pgrst, 'reload schema';
