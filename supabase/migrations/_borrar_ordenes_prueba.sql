-- Borra TODAS las órdenes y estampillas de la base (sin excepción).
-- Es irreversible. Se borra primero estampillas (tiene una llave
-- foránea hacia ordenes) y después ordenes.
-- No toca packs_config, sorteo_config, vehicles ni ninguna otra tabla.

DELETE FROM estampillas;
DELETE FROM ordenes;
