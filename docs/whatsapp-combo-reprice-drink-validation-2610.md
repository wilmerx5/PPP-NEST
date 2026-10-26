# Tanda 218 — bebida explícita al aceptar un precio actualizado

Base: `28017854`, rama staging. Sin llamadas pagadas, Meta ni órdenes externas.

## Fallo reproducido

Al elegir una presentación con Agua después de que cambiara su precio, se solicitaba aceptar el nuevo precio, pero se descartaba Agua. La aceptación recuperaba Pepsi de la oferta inicial. Baseline: 18 fallos y 12 controles aprobados en 30 conversaciones, tres menús sintéticos y agente simulado desactivado/activado.

## Corrección general

La recotización conserva las opciones validadas contra el catálogo actual, junto con la cantidad pendiente. No modifica el carrito antes de aceptar. Otra presentación conserva sus propias opciones, y rechazar mantiene el producto original. No hay excepciones por nombre, ID o precio de restaurante.

## Cobertura

42 conversaciones: tres menús (arroz, bowl y pasta), dos modos simulados, siete caminos: selección por etiqueta, código o volumen; rechazo; otra presentación; segundo cambio de precio; bebida inválida seguida de selección válida. Cada conversación verifica respuesta, carrito, estado pendiente y cierre con DTO simulado, dos unidades y notas. Las opciones se verifican tanto en carrito como en cada unidad del DTO para los combos.

Foco final: 168/168 en tres suites. TypeScript general/build, 92 controles Node y guardia Falafel aprobados. Global inicial: 19.410 aprobadas y 6 fallidas, 284 suites, fuente congelada. Los seis fallos eran el contrato anterior que exigía repetir Pepsi después de aceptar el precio. Se actualizó únicamente esa prueba: no se debilitó la comprobación de cantidad, precio, nota ni bebida/DTO; ahora exige ausencia de pregunta pendiente. Reejecución afectada: 78/78 en dos suites. Evidencia combinada: 19.416 pruebas/284 suites, inventario exacto y hashes de runtime sin cambios. No es una segunda global íntegra verde; se reutilizan los resultados verdes del run completo porque solo cambió la aserción de ese contrato. Evidencias privadas `/tmp/ppp-218-*`.

## Límites y siguiente bloque

No acredita inferencia real, geocodificación ni costo por pedido. No hay despliegue. Main permanece intacta. Siguiente: opción retirada entre recotización y aceptación, disponibilidad que cambia y consultas/contactos durante la aceptación del precio. No declarar vendible por conteos.
