# Tanda297 — cambio parcial de preparación hasta orden

## VIGENTE — tanda297: preparación parcial hasta confirmación (29/10)

Base `250febb5`.72 recorridos nuevos: tres catálogos sintéticos, agente simulado off/on, grupos de2/3/4 unidades, posición de línea alternada y efectivo/transferencia. «Cámbiame uno de los de pechuga a pollo broaster» y referencias equivalentes de tofu/pescado. Separa exactamente una unidad, conserva notas y atributos compatibles, mantiene la otra línea con bebida/opciones distintas y aplica el precio del destino. Verifica carrito exacto, respuesta, estados de recogida/pago/confirmación, ausencia de creación anticipada, una sola creación, unidades del DTO con notas/atributos y recibo con total correcto.

Baseline72/72; foco466/3; TypeScript general/build aprobados. Sin fallos nuevos ni cambios del motor; publicación de pruebas, sin despliegue. Último global de runtime:26514/362 en295, no reejecutado ni atribuido al inventario ampliado297. Evidencia `whatsapp-batch-297-validation.json` y `whatsapp-batch-297-patterns.md`.

PPP staging295, producción292, Kamppo282 según última verificación registrada. Cero inferencia/Meta/órdenes externas; ledger267/256/11 intacto. No implica validación con modelo real. Idiomas aplazados. Próximo: recuperación de operaciones mixtas ambiguas y continuidad tras aclaraciones, conservando el pedido hasta resolver destino y cantidad.

Fuente conceptual: chat del hilo donde «cámbiame el de pechuga con pollo broaster» agregó un pollo entero en vez de sustituir el ejecutivo. Esta tanda amplía la regresión existente con unidades agrupadas y persistencia final; no reproduce íntegramente aquel chat. No se releyeron audios/PDF adicionales.
