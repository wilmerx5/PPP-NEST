# Tanda193 — compra condicional frente a exploración por preparación

Base5a7999eb, staging, 25/10/2026. Corrección parcial: no cierra la compra larga ni el reparto de acompañamientos.

## Causa y cambio

El detector de exploración por preparación devolvía un estilo ante «Me das un pollo frito si tienes yuca mejor», aunque «Quiero un pollo frito si tienes yuca mejor» ya quedaba fuera de ese camino. La condición de inventario se confundía con una invitación a listar productos por estilo.

Ahora un prefijo explícito de compra con cantidad y una condición de inventario no se convierte en exploración por preparación. La frase completa permanece intacta para el manejador de pedidos: no se elimina la condición, no se añade automáticamente un acompañamiento ni se promete una sustitución. Regla independiente de IDs, precios o nombres del restaurante.

## Evidencia focal

21 casos nuevos en `whatsapp-conditional-style-routing.spec.ts`: pollo frito, pescado asado y berenjena gratinada; cuatro fórmulas de compra; tres consultas reales por preparación; seis recorridos del router con agente simulado on/off.

Baseline ampliado:9fallos/12aprobados,9,833s. Seis fallos del clasificador y tres del router sin agente. El router con agente ya pasaba antes: no atribuirle una mejora nueva. Tras el cambio21/21; junto a regresiones existentes179/179,36,311s. TypeScript general/build y Node92/92 aprobados.

Los recorridos comprueban ausencia de la selección de preparaciones errónea; con agente simulado se verifica llamada al agente y carrito vacío ante respuesta sin acciones. No son pruebas de éxito del pedido ni cierre DTO. El cambio de clasificación no acredita comprensión del modelo real.

## Replay y fallos pendientes

Repetición de los20diagnósticos191/192:14FALLIDOS/6aprobados,39,111s. En PPP sin agente ya no aparece el catálogo general broaster: aparece una elección de versiones de pollo frito. La corrección posterior recupera pollo frito×1 y broaster×1 (antes quedaba solo broaster), pero siguen faltando los plátanos. El flujo completo NO está arreglado.

Los18casos sintéticos192 conservan12rojos/6verdes: no se atribuyen al clasificador de preparación, que ya devolvía null. Permanecen opt-in, fuera del inventario verde. Evidencia `/tmp/ppp-193-open.json` y las trazas de replay191 sobrescritas por esa ejecución. No sumar ejecuciones repetidas como casos únicos.

## Próximo trabajo

El siguiente cambio debe actuar sobre la representación completa de compra y condición: preservar platos y productos posteriores, conservar la condición, pedir asignación específica cuando «uno/otro» no identifica el plato y recuperar compras parciales sin duplicar. Debe incluir respuestas semánticas válidas, vacías y errores de proveedor como escenarios distintos, y comprobar DTO final. No basta con seguir cambiando el clasificador ni eliminar palabras como «si».

Cero llamadas pagadas, Meta u órdenes externas. Main/producción intactas. Sin despliegue en esta tanda. Global aprobada:18.545 pruebas/260 suites,562 hashes,698,86s; inventario exacto y fuentes congeladas. Evidencia `/tmp/ppp-193-global-summary.json`. Publicado solo en rama staging.
