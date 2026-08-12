-- ============================================================
-- IAC ARICA 2026 — Parte 26
-- "Adecua el sistema para que solo los pagos sean por Flow, y que si
-- no se ha recibido el pago no se pueda confirmar."
--
-- Hasta ahora el botón "Confirmar pago" del panel admin llamaba
-- confirmar_orden(uuid) directo (grant a "authenticated"), sin
-- verificar nada: era 100% a criterio del admin (diseño original
-- pensado para transferencia bancaria manual, calzando a ojo). Eso
-- ya no es aceptable ahora que el objetivo es que SOLO Flow confirme
-- pagos reales.
--
-- Se saca el permiso de "authenticated" sobre confirmar_orden(uuid):
-- de ahora en adelante la ÚNICA vía para confirmar una orden es
-- flow-webhook (service_role), que antes de tocar la base SIEMPRE
-- vuelve a preguntarle a Flow (payment/getStatus) si el pago
-- realmente se recibió. stamper-admin.html ahora llama a esa misma
-- función (en vez de a este RPC) para el caso "el webhook automático
-- no llegó" — pero la decisión de confirmar sigue siendo 100% de
-- Flow, nunca del admin.
-- ============================================================

REVOKE EXECUTE ON FUNCTION confirmar_orden(uuid) FROM authenticated;
-- service_role mantiene su permiso (ya otorgado en la parte 19) —
-- solo flow-webhook puede ejecutar esta función.

NOTIFY pgrst, 'reload schema';
