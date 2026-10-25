# Tanda185 — declaraciones de destino sin compras espurias

Base `714c985e`, rama staging, 25/10/2026. Caso CHAT2510-16 de la auditoría: «El pedido es para jardines 4 la casa 4» se convertía en cuatro unidades de código4. No se añade excepción por nombre del conjunto, código ni restaurante.

## Cambio

Antes de normalizar compras/consultas, reconocer declaraciones explícitas «el/mi/este pedido/domicilio es/sería/va para/a/en …» cuando la cola es un destino independiente. Reutilizar el flujo de «La dirección es …». La cola debe parecer dirección o nombre con unidad numerada; se excluyen preguntas, instrucciones de compra, cantidades iniciales, comida y añadidos explícitos. Se conserva el mensaje original recibido en historial; la transformación solo afecta el texto de enrutamiento.

El destino se procesa por los validadores existentes de dirección y cobertura. La normalización NO confirma coordenadas, no inventa cobertura ni altera tarifas. La prueba usa tarifa fija simulada y no acredita calidad del geocodificador.

## Evidencia

- Baseline184: seis diagnósticos rojos (bowl/pizza/ramen × agente simulado off/on). Sin agente, conserva destino viejo; con agente simulado añade cuatro Bandejas Especiales. El mock de agente tiene acciones vacías: existe camino determinista que permite la compra.
- Primer intento de normalizar solo direcciones ya reconocidas no resolvió «jardines4 casa4». Se amplió a nombre con unidad numerada dentro de declaración explícita, sin añadir alias local.
- Seis reproducciones originales pasan después del cambio. Se retira `whatsapp-address-number-preservation.repro.ts`, promovido y ampliado a `whatsapp-explicit-destination.spec.ts`.
- Matriz nueva: 36 casos (3menús × agente off/on × pago/confirmación × 3formas de destino). Cada destino se repite: no cambia carrito, conserva dos unidades/notas, descarta dirección vieja, guía al próximo paso y no crea orden antes de confirmar. En confirmación conserva el pago ya seleccionado. Cierre simulado verifica DTO con dos unidades y notas, nombre y tarifa.
- Foco amplio: 361/361 en5suites,41,215s; incluye dirección numérica, lookup de órdenes/horarios, nombres e intención. Después de fortalecer el fixture con pago previo: matriz36/36,10,76s.
- TypeScript general/build finales aprobados tras fortalecer el fixture; Node92/92 aprobado.

## Límites y pendientes

No inferencia real, Meta, WhatsApp ni órdenes externas. No se ensayan ráfagas en esta matriz. No cubre todos los mensajes mixtos compra+destino; deliberadamente no reescribe su contenido. No resuelve las otras12 reproducciones rojas de auditoría184 ni las6 de compra+Nequi183. Tampoco arregla geocodificación de interiores aislados ni pérdida de bebida al reemplazar.

Siguiente prioridad: separar compra de pregunta total/transferencia sin convertir ingredientes en SKUs; después cambio de ejecutivo existente sin unidad extra. Ejecutar rojo→verde y cierre completo, sin repetir auditoría como si fuera corrección. Main/producción permanecen intactas. Despliegue de staging se agrupa aparte; publicar commit no significa desplegar.

Logs: `/tmp/ppp-185-probe2.log`, `/tmp/ppp-185-focus.{log,json}`, `/tmp/ppp-185-final-focus.log`, `/tmp/ppp-185-tsc.log`, `/tmp/ppp-185-tsc-build.log`, `/tmp/ppp-185-node.log`. Global final: **18.373/18.373 pruebas,253suites,553hashes,679,47s**, inventario exacto y fuente sin cambios. Evidencia `/tmp/ppp-185-global-summary.json`, hashes y logs burst/rest. TypeScript final en `/tmp/ppp-185-tsc-final.log` y `/tmp/ppp-185-tsc-build-final.log`.

## Preparación de la siguiente tanda (sin editar runtime durante global185)

Compra+Nequi tiene dos rutas de `splitPriceAndOrderParts`: la primera solo consume la separación cuando `tryHandleProductInfoInquiry` responde; una pregunta de total/pago no equivale a precio de producto y puede conservar el mensaje global que activa cotización. No basta con añadir «regala» a una expresión: diagnóstico183 sin pregunta también pierde sopa independiente. Próximo cambio debe separar las dos causas, conservar los datos de entrega y responder al total desde carrito validado. Esta observación es revisión de código, no una corrección ni nueva prueba aprobada.
