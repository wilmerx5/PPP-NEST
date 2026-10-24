# Tanda150 — interior parcial y compra adicional con cabeza ambigua

Base6ac84a03, staging.31 casos nuevos:12 direcciones,12 conversaciones de compra ambigua/interrupción por precio,7 contratos de combinación de acceso.

## Fallos reproducidos

Completar calle con solo apartamento nuevo conservaba el conjunto pero descartaba la torre. Baseline dirección6 fallidos/6 aprobados: reemplazo explícito ya correcto. Se combinan componentes etiquetados (apartamento/apto, interior/int, torre, bloque, casa, piso, local, oficina, entrada); solo el componente suministrado reemplaza al previo. Se mantienen referencias no modificadas. Reemplazar explícitamente el destino sigue descartando datos anteriores.

Una compra adicional por cabeza compartida («Agrega un bowl frito sin arroz») podía editar la unidad existente o preguntar sin alternativas. Baseline5 fallos/1 correcto con tres cartas y agente simulado on/off. Cuando las alternativas disponibles comparten esa cabeza y admiten la opción indicada, se abre pendingMatch real con cantidad/texto original y candidatos. No se modifica el carrito; responder el nombre aplica preparación/nota originales. Checkout mantiene paso pendiente. La expansión única de149 se conserva.

## Oráculos

Dirección desde compra hasta DTO, incluyendo respuesta y sesión, conserva torre3 y cambia apto402 a708 al completar; reemplazo explícito no hereda torre ni conjunto. Contratos cubren también interior, casa, oficina, referencia y componente nuevo.

Ambigüedad en bowl/hamburguesa/sándwich con dos productos por carta. Primero compra unidad asada/sin cebolla; después pide adicional frito/sin arroz. Debe mostrar ambos candidatos y conservar carrito. Pregunta precio del vegetal, responde20.000 y conserva pendingMatch. Elige pollo, mantiene dos unidades con opciones/notas separadas. Se ejecuta desde compra y desde pago, agente simulado on/off, hasta DTO exacto y una sola creación simulada.

## Validación

Foco66/66 (24 nuevos +42 anteriores),18,425s; contratos7/7. TypeScript general/build OK, Node92/92. Global17.213/17.213,215suites,513hashes,642,96s; inventario exacto/fuente congelada. Evidencia /tmp/ppp-150-global-summary.json. Evidencia /tmp/ppp-150-{address-baseline,alias-baseline,expanded,unit,tsc,node}.log. No sumar reintentos.

## Límites y siguiente paso

Cero API pagada, Meta u órdenes externas. Modelos y geocodificación simulados: no mide reconocimiento real ni disponibilidad del mapa. Ambigüedad se prueba con cabeza exacta compartida, compra explícita, opción soportada por todas las candidatas y sin otra selección pendiente. No extrapolar a alias fonéticos, opción exclusiva de una alternativa, productos agotados entre oferta/elección ni encabezados contradictorios. Interior cubre identificadores simples; dos valores contradictorios del mismo componente en un mensaje requieren aclaración futura.

Siguiente: alternativas con distinta disponibilidad/opciones, cambio de opinión durante esta elección y direcciones con dos apartamentos contradictorios. Contraste real acotado sigue pendiente en whatsapp-api-validation-next-2310.md, con presupuesto antes de red. No declarar vendible por conteos.

Publicación solo staging después de global. Agrupar próximo despliegue; último servidor verificado2c02456a, tandas148–149. Main/producción intactas.
