# Tanda148 — conservar variantes y completar conjuntos

Base e9635765, solo staging. 24 conversaciones nuevas gratuitas con router completo, tres cartas por familia y agente simulado activado/desactivado.

## Fallos reproducidos

- Una compra adicional explícita de la misma referencia con otra preparación podía editar la unidad anterior. La normalización convierte «Agrega» en «Quiero» antes del detector de cambios de opciones. El detector debe dejar pasar compras con cantidad y nombre completo del catálogo.
- «Solo quiero uno… y que lleve…» podía descartar líneas que tenían notas diferentes, aunque sus opciones fueran iguales. La identidad para decidir si puede consolidar incluye notas; si difieren, pregunta cuál conservar sin mutar el carrito.
- Al responder con calle y número después de un conjunto no localizado se perdían el nombre del conjunto, torre y apartamento. Se conserva esa información cuando el cliente completa una ubicación pendiente; «Cambiar dirección a…» sigue siendo reemplazo.

## Evidencia y oráculos

Baseline variantes: 12 fallos, seis en compra adicional inicial y seis en consolidación de notas. Baseline dirección: seis fallos de completar y seis reemplazos ya correctos. No sumar reintentos como casos distintos.

Foco nuevo final24/24: compra inicial y adicional, pregunta ambigua sin mutación, elección por nota, checkout y DTO exacto de una unidad. Dirección comprueba respuesta, sesión y DTO conservando interior en complemento y retirándolo en reemplazo. Órdenes mock, sin creación prematura. TypeScript general/build OK y Node92/92.

Global completa17.152/17.152,210suites,508hashes,767,34s; inventario exacto y fuente congelada. /tmp/ppp-148-global-summary.json. Evidencia focal /tmp/ppp-148-focus2.log; baselines /tmp/ppp-148-baseline.log y /tmp/ppp-148-address-baseline.log.

## Límites y siguiente tanda

Cero llamadas pagadas, Meta u órdenes externas. Modelos y geocodificador simulados: no acreditan reconocimiento de audio ni búsqueda real de conjuntos. La conservación de dirección requiere conjunto explícito pendiente sin coordenadas y calle nueva sin interior propio. No acredita fusión de referencias contradictorias ni direcciones con interior nuevo. Compras adicionales verificadas con nombre completo y cantidad; alias y cláusulas elípticas requieren siguiente tanda.

Continuar con dirección completada que cambia torre/apartamento y controles de no arrastrar detalles de otra ubicación; compra adicional por alias frente a modificación explícita de variante. Sigue pendiente contraste real acotado de docs/whatsapp-api-validation-next-2310.md, con presupuesto registrado antes de red. No declarar vendible por conteos. Main/producción intactas. Publicación solo staging; despliegue agrupado pendiente, servidor último verificado eef121c1 (tandas146–147).
